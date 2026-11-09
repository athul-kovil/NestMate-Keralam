/**
 * NestMate Kerala - Data Layer & Storage Manager
 * Tailored for Kerala, India (Kochi, Trivandrum, Kozhikode, etc.)
 * Starts 100% fresh with NO pre-filled sample listings so you can add your own real photos and details.
 */

// Popular Kerala hubs for fast autocomplete and filtering
const KERALA_HUBS = [
  // Kochi
  "Kakkanad (Infopark), Kochi",
  "Edappally, Kochi",
  "Palarivattom, Kochi",
  "Kaloor, Kochi",
  "Vyttila, Kochi",
  "Marine Drive, Kochi",
  "Aluva, Kochi",
  "Fort Kochi, Kochi",
  // Trivandrum
  "Kazhakkoottam (Technopark), Trivandrum",
  "Karyavattom, Trivandrum",
  "Kowdiar, Trivandrum",
  "Pattom, Trivandrum",
  "Vellayambalam, Trivandrum",
  "Thampanoor, Trivandrum",
  // Kozhikode (Calicut)
  "Cyberpark, Kozhikode",
  "Hilite City / Palazhi, Kozhikode",
  "Palayam, Kozhikode",
  "Mavoor Road, Kozhikode",
  // Other Major Hubs
  "Swaraj Round, Thrissur",
  "Ayyanthole, Thrissur",
  "Kottayam Town",
  "Palakkad Town",
  "Kannur Town",
  "Kollam Town"
];

// Fallback room icon SVG data URI when no photos are uploaded
const KERALA_ROOM_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23059669'/%3E%3Cstop offset='100%25' stop-color='%230d9488'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Ccircle cx='400' cy='220' r='75' fill='%23ffffff' opacity='0.2'/%3E%3Cpath d='M360 220 L400 180 L440 220 L430 220 L430 255 L370 255 L370 220 Z' fill='%23ffffff'/%3E%3Ctext x='400' y='320' font-family='sans-serif' font-size='28' font-weight='bold' fill='%23ffffff' text-anchor='middle'%3ENestMate Kerala%3C/text%3E%3Ctext x='400' y='355' font-family='sans-serif' font-size='16' fill='%23d1fae5' text-anchor='middle'%3EFind Roommates in Kochi, Trivandrum, Calicut%3C/text%3E%3C/svg%3E";

// Default fresh state with zero pre-filled sample listings or conversations
const INITIAL_USERS = [];
const INITIAL_LISTINGS = [];
const INITIAL_CONVERSATIONS = [];

// Compatibility Match Calculation Engine (Kerala context)
function calculateCompatibility(user, listing, host) {
  if (!user) {
    return {
      score: 85,
      tier: "high",
      label: "Ready to Connect",
      breakdown: [{ factor: "Profile", status: "neutral", text: "Sign in to see personalized compatibility" }]
    };
  }

  let score = 0;
  let breakdown = [];

  // 1. Smoking Character Match (Weight: 25%)
  if (listing.smokingRule === "no") {
    if (user.smoking === "no") {
      score += 25;
      breakdown.push({ factor: "Smoking Habit", status: "match", text: "100% Match: Strictly non-smoking" });
    } else {
      score += 5;
      breakdown.push({ factor: "Smoking Habit", status: "mismatch", text: "Notice: House prohibits smoking" });
    }
  } else if (listing.smokingRule === "balcony_only") {
    if (user.smoking === "no" || user.smoking === "social") {
      score += 22;
      breakdown.push({ factor: "Smoking Habit", status: "match", text: "Compatible: Balcony smoking only" });
    } else {
      score += 15;
      breakdown.push({ factor: "Smoking Habit", status: "neutral", text: "Allowed outside/balcony" });
    }
  } else {
    score += 25;
    breakdown.push({ factor: "Smoking Habit", status: "match", text: "Flexible smoking policy" });
  }

  // 2. Drinking Character Match (Weight: 15%)
  if (listing.drinkingRule === "no") {
    if (user.drinking === "no") {
      score += 15;
      breakdown.push({ factor: "Drinking Habit", status: "match", text: "Both prefer alcohol-free household" });
    } else {
      score += 5;
      breakdown.push({ factor: "Drinking Habit", status: "mismatch", text: "Host prefers non-drinker" });
    }
  } else {
    if (user.drinking === "social" || user.drinking === "no") {
      score += 15;
      breakdown.push({ factor: "Drinking Habit", status: "match", text: "Social or non-drinking friendly" });
    } else {
      score += 10;
      breakdown.push({ factor: "Drinking Habit", status: "neutral", text: "Acceptable habits" });
    }
  }

  // 3. Working Time & Shift Compatibility (Weight: 25%)
  if (listing.workingShiftPreference === "day") {
    if (user.workingShift === "day") {
      score += 25;
      breakdown.push({ factor: "Work Schedule", status: "match", text: "Synchronized Day Shift (9 AM – 6 PM)" });
    } else if (user.workingShift === "wfh") {
      score += 20;
      breakdown.push({ factor: "Work Schedule", status: "match", text: "Good harmony (Day office & WFH)" });
    } else {
      score += 15;
      breakdown.push({ factor: "Work Schedule", status: "neutral", text: "Different shifts (Provides extra privacy)" });
    }
  } else if (listing.workingShiftPreference === "wfh") {
    if (user.workingShift === "wfh" || user.workingShift === "day") {
      score += 25;
      breakdown.push({ factor: "Work Schedule", status: "match", text: "Remote & work-from-home friendly" });
    } else {
      score += 18;
      breakdown.push({ factor: "Work Schedule", status: "neutral", text: "Compatible work routine" });
    }
  } else {
    score += 25;
    breakdown.push({ factor: "Work Schedule", status: "match", text: "All work shifts welcome" });
  }

  // 4. Budget Compatibility in ₹ INR (Weight: 20%)
  const userBudget = user.budget || 8000;
  if (listing.rentSplit <= userBudget) {
    score += 20;
    breakdown.push({ factor: "Budget Fit", status: "match", text: `Within your budget (₹${listing.rentSplit.toLocaleString('en-IN')} ≤ ₹${userBudget.toLocaleString('en-IN')})` });
  } else if (listing.rentSplit <= userBudget * 1.2) {
    score += 14;
    breakdown.push({ factor: "Budget Fit", status: "neutral", text: `Close to budget (₹${listing.rentSplit.toLocaleString('en-IN')} vs ₹${userBudget.toLocaleString('en-IN')})` });
  } else {
    score += 6;
    breakdown.push({ factor: "Budget Fit", status: "mismatch", text: `Above target budget (₹${listing.rentSplit.toLocaleString('en-IN')})` });
  }

  // 5. Gender & Cleanliness Alignment (Weight: 15%)
  let subPoints = 0;
  if (listing.genderPreference === "any" || (user.gender && listing.genderPreference.toLowerCase() === user.gender.toLowerCase())) {
    subPoints += 8;
  } else {
    subPoints += 2;
  }

  if (listing.cleanlinessExpectation === user.cleanliness || user.cleanliness === "high") {
    subPoints += 7;
    breakdown.push({ factor: "Cleanliness", status: "match", text: "Cleanliness expectations aligned" });
  } else {
    subPoints += 4;
    breakdown.push({ factor: "Cleanliness", status: "neutral", text: "Moderate housekeeping" });
  }
  score += subPoints;

  // Clamp 0 to 100
  score = Math.min(100, Math.max(35, Math.round(score)));

  let tier = "moderate";
  let label = "Moderate Match";
  if (score >= 90) {
    tier = "high";
    label = "Exceptional Match ✨";
  } else if (score >= 75) {
    tier = "medium";
    label = "Great Match 👍";
  }

  return {
    score,
    tier,
    label,
    breakdown
  };
}

// Storage Manager for LocalStorage persistence
const Storage = {
  getUsers() {
    const data = localStorage.getItem("nestmate_kerala_users");
    return data ? JSON.parse(data) : [];
  },
  saveUsers(users) {
    localStorage.setItem("nestmate_kerala_users", JSON.stringify(users));
  },
  getListings() {
    const data = localStorage.getItem("nestmate_kerala_listings");
    return data ? JSON.parse(data) : [];
  },
  saveListings(listings) {
    localStorage.setItem("nestmate_kerala_listings", JSON.stringify(listings));
  },
  getCurrentUser() {
    const data = localStorage.getItem("nestmate_kerala_current_user");
    return data ? JSON.parse(data) : null;
  },
  setCurrentUser(user) {
    if (user) {
      localStorage.setItem("nestmate_kerala_current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("nestmate_kerala_current_user");
    }
  },
  getFavorites() {
    const data = localStorage.getItem("nestmate_kerala_favorites");
    return data ? JSON.parse(data) : [];
  },
  saveFavorites(favs) {
    localStorage.setItem("nestmate_kerala_favorites", JSON.stringify(favs));
  },
  getConversations() {
    const data = localStorage.getItem("nestmate_kerala_conversations");
    return data ? JSON.parse(data) : [];
  },
  saveConversations(convs) {
    localStorage.setItem("nestmate_kerala_conversations", JSON.stringify(convs));
  },
  clearAll() {
    localStorage.removeItem("nestmate_kerala_users");
    localStorage.removeItem("nestmate_kerala_listings");
    localStorage.removeItem("nestmate_kerala_current_user");
    localStorage.removeItem("nestmate_kerala_favorites");
    localStorage.removeItem("nestmate_kerala_conversations");
  }
};
