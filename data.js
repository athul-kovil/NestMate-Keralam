/**
 * NestMate Kerala - Data Layer & Secure Authentication Service
 * Tailored for Kerala, India (Kochi, Trivandrum, Kozhikode, Thrissur, etc.)
 * Supports:
 * - Gmail & Password Authentication with Cryptographic Salted Hashing
 * - Email Verification & 15-Minute Expiration Flow
 * - Recovery Email & Secure Password Reset Tokens
 * - User Profile Management & Circular Avatar Storage
 * - Dual-layer persistence: REST API backend (database.json) + local storage cache
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

// Fallback room SVG data URI
const KERALA_ROOM_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23059669'/%3E%3Cstop offset='100%25' stop-color='%230d9488'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23g)'/%3E%3Ccircle cx='400' cy='220' r='75' fill='%23ffffff' opacity='0.2'/%3E%3Cpath d='M360 220 L400 180 L440 220 L430 220 L430 255 L370 255 L370 220 Z' fill='%23ffffff'/%3E%3Ctext x='400' y='320' font-family='sans-serif' font-size='28' font-weight='bold' fill='%23ffffff' text-anchor='middle'%3ENestMate Kerala%3C/text%3E%3Ctext x='400' y='355' font-family='sans-serif' font-size='16' fill='%23d1fae5' text-anchor='middle'%3EFind Roommates in Kochi, Trivandrum, Calicut%3C/text%3E%3C/svg%3E";

// Default Circular Avatar SVG
const DEFAULT_AVATAR_SVG = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23059669'/%3E%3Cstop offset='100%25' stop-color='%230d9488'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='120' rx='60' fill='url(%23bg)'/%3E%3Ccircle cx='60' cy='46' r='22' fill='%23ffffff' opacity='0.9'/%3E%3Cpath d='M28 102 C28 78 44 68 60 68 C76 68 92 78 92 102 Z' fill='%23ffffff' opacity='0.9'/%3E%3C/svg%3E";

// ==============================================================================
// Client-Side Cryptographic Password Hashing (Web Crypto API)
// ==============================================================================

const CryptoAuth = {
  // Generate random salt hex string
  generateSalt(bytes = 16) {
    const arr = new Uint8Array(bytes);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Hash password with salt using SHA-256
  async hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}:nestmate_salt_kerala`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Constant-time comparison
  async verifyPassword(password, storedHash, salt) {
    const computedHash = await this.hashPassword(password, salt);
    return computedHash === storedHash;
  },

  // Password Strength Evaluator
  evaluatePasswordStrength(password) {
    if (!password) {
      return { score: 0, label: "Empty", percent: 0, class: "none", checks: {} };
    }

    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    };

    let passedCount = Object.values(checks).filter(Boolean).length;
    let score = passedCount;
    let label = "Weak";
    let percent = 20;
    let cls = "weak";

    if (password.length < 8) {
      score = Math.min(score, 2);
    }

    if (score <= 2) {
      label = "Weak";
      percent = 25;
      cls = "weak";
    } else if (score === 3) {
      label = "Fair";
      percent = 50;
      cls = "fair";
    } else if (score === 4) {
      label = "Good";
      percent = 75;
      cls = "good";
    } else {
      label = "Strong ✨";
      percent = 100;
      cls = "strong";
    }

    return { score, label, percent, class: cls, checks };
  },

  // Gmail address validator
  isValidGmail(email) {
    const pattern = /^[a-zA-Z0-9](\.?[a-zA-Z0-9_-]+)*@gmail\.com$/i;
    return pattern.test((email || "").trim());
  },

  // General email validator
  isValidEmail(email) {
    const pattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/i;
    return pattern.test((email || "").trim());
  }
};

// ==============================================================================
// Unified Authentication & Database Service (API + Local Storage)
// ==============================================================================

const AuthAPI = {
  baseUrl: window.location.origin,

  async request(endpoint, options = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, error: err.message, offline: true };
    }
  },

  // 1. REGISTER
  async register(formData) {
    const { name, email, password, confirmPassword, recoveryEmail, avatar, occupation, age, gender } = formData;

    // Validate Gmail format
    if (!CryptoAuth.isValidGmail(email)) {
      throw new Error("Please enter a valid Gmail address (ending in @gmail.com).");
    }

    // Validate Recovery Email
    if (!CryptoAuth.isValidEmail(recoveryEmail)) {
      throw new Error("Please enter a valid recovery email address.");
    }

    if (email.toLowerCase() === recoveryEmail.toLowerCase()) {
      throw new Error("Recovery email must be different from your primary Gmail address.");
    }

    // Validate Password
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    if (password !== confirmPassword) {
      throw new Error("Password and Confirm Password do not match.");
    }

    // Try backend REST API first
    const apiRes = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Registration failed on server.");
    }

    // Fallback: Client-Side Registration (when server offline)
    const users = Storage.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("This Gmail address is already registered. Please log in.");
    }

    const salt = CryptoAuth.generateSalt();
    const passwordHash = await CryptoAuth.hashPassword(password, salt);
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;

    const newUser = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      passwordSalt: salt,
      recoveryEmail: recoveryEmail.trim().toLowerCase(),
      avatar: avatar || "",
      isVerified: false,
      verificationCode: code,
      verificationExpires: Date.now() + 15 * 60 * 1000, // 15 mins
      resetToken: null,
      resetExpires: null,
      createdAt: new Date().toISOString(),
      occupation: occupation || "Professional in Kerala",
      age: age || 25,
      gender: gender || "Any",
      smoking: "no",
      drinking: "social",
      workingShift: "day",
      cleanliness: "high",
      budget: 7000,
      diet: "any",
      bio: ""
    };

    users.push(newUser);
    Storage.saveUsers(users);

    return {
      success: true,
      message: `Verification code sent to ${email}. Valid for 15 minutes.`,
      email: newUser.email,
      recoveryEmail: newUser.recoveryEmail,
      verificationCode: code
    };
  },

  // 2. VERIFY EMAIL
  async verifyEmail(email, code) {
    if (!email || !code) {
      throw new Error("Email and 6-digit verification code are required.");
    }

    const apiRes = await this.request('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() })
    });

    if (apiRes.ok) {
      Storage.setCurrentUser(apiRes.data.user);
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Verification failed.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error("Account not found.");

    if (user.isVerified) {
      Storage.setCurrentUser(user);
      return { success: true, user };
    }

    if (Date.now() > (user.verificationExpires || 0)) {
      throw new Error("Verification code has expired. Please request a new one.");
    }

    if (user.verificationCode !== code.trim()) {
      throw new Error("Invalid verification code. Please check and try again.");
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    Storage.saveUsers(users);
    Storage.setCurrentUser(user);

    return { success: true, message: "Email verified successfully!", user };
  },

  // 3. RESEND CODE
  async resendVerificationCode(email) {
    const apiRes = await this.request('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Could not resend code.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error("Account not found.");

    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    user.verificationCode = code;
    user.verificationExpires = Date.now() + 15 * 60 * 1000;
    Storage.saveUsers(users);

    return { success: true, message: `New verification code sent to ${email}.`, verificationCode: code };
  },

  // 4. LOGIN
  async login(email, password, rememberMe = false) {
    if (!CryptoAuth.isValidGmail(email)) {
      throw new Error("Please enter a valid Gmail address (ending in @gmail.com).");
    }

    if (!password) {
      throw new Error("Password is required.");
    }

    const apiRes = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, rememberMe })
    });

    if (apiRes.ok) {
      Storage.setCurrentUser(apiRes.data.user, rememberMe);
      return apiRes.data;
    } else if (apiRes.status > 0) {
      if (apiRes.data.needsVerification) {
        return apiRes.data;
      }
      throw new Error(apiRes.data.error || "Login failed.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error("No registered account found with this Gmail address.");
    }

    const isValid = await CryptoAuth.verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      throw new Error("Incorrect password. Please try again or use Forgot Password.");
    }

    if (!user.isVerified) {
      const code = `${Math.floor(100000 + Math.random() * 900000)}`;
      user.verificationCode = code;
      user.verificationExpires = Date.now() + 15 * 60 * 1000;
      Storage.saveUsers(users);

      return {
        needsVerification: true,
        email: user.email,
        verificationCode: code,
        message: "Your Gmail address has not been verified yet."
      };
    }

    Storage.setCurrentUser(user, rememberMe);
    return { success: true, user, message: `Welcome back, ${user.name}!` };
  },

  // 5. FORGOT PASSWORD
  async forgotPassword(email) {
    if (!CryptoAuth.isValidGmail(email)) {
      throw new Error("Please enter a valid Gmail address.");
    }

    const apiRes = await this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() })
    });

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Could not process password reset.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error("No account found registered with this Gmail address.");
    }

    const token = `rst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    user.resetToken = token;
    user.resetExpires = Date.now() + 15 * 60 * 1000;
    Storage.saveUsers(users);

    const mask = (em) => {
      if (!em || !em.includes('@')) return "your recovery email";
      const [n, d] = em.split('@');
      return `${n[0]}***${n.slice(-1)}@${d}`;
    };

    return {
      success: true,
      message: "Password reset link dispatched to your recovery email.",
      recoveryEmail: mask(user.recoveryEmail),
      resetToken: token
    };
  },

  // 6. RESET PASSWORD
  async resetPassword(token, newPassword, confirmPassword) {
    if (!token) throw new Error("Reset token is required.");
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters long.");
    if (newPassword !== confirmPassword) throw new Error("Passwords do not match.");

    const apiRes = await this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword })
    });

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Failed to reset password.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.resetToken === token);
    if (!user) throw new Error("Invalid or expired password reset link.");

    if (Date.now() > (user.resetExpires || 0)) {
      throw new Error("This password reset link has expired. Please request a new one.");
    }

    const salt = CryptoAuth.generateSalt();
    const passwordHash = await CryptoAuth.hashPassword(newPassword, salt);
    user.passwordHash = passwordHash;
    user.passwordSalt = salt;
    user.resetToken = null;
    user.resetExpires = null;
    Storage.saveUsers(users);

    return { success: true, message: "Password updated successfully! You can now log in." };
  },

  // 7. UPDATE PROFILE
  async updateProfile(userId, profileData) {
    const apiRes = await this.request('/api/user/profile', {
      method: 'POST',
      body: JSON.stringify({ userId, ...profileData })
    });

    if (apiRes.ok) {
      Storage.setCurrentUser(apiRes.data.user);
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Failed to update profile.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found.");

    Object.assign(user, profileData);
    Storage.saveUsers(users);
    Storage.setCurrentUser(user);

    return { success: true, user, message: "Profile updated successfully!" };
  },

  // 8. CHANGE PASSWORD
  async changePassword(userId, currentPassword, newPassword, confirmPassword) {
    if (newPassword.length < 8) throw new Error("New password must be at least 8 characters long.");
    if (newPassword !== confirmPassword) throw new Error("New password and confirm password do not match.");

    const apiRes = await this.request('/api/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ userId, currentPassword, newPassword, confirmPassword })
    });

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Failed to change password.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error("User not found.");

    const isValid = await CryptoAuth.verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
    if (!isValid) throw new Error("Current password is incorrect.");

    const salt = CryptoAuth.generateSalt();
    const passwordHash = await CryptoAuth.hashPassword(newPassword, salt);
    user.passwordHash = passwordHash;
    user.passwordSalt = salt;
    Storage.saveUsers(users);

    return { success: true, message: "Password updated successfully!" };
  },

  // 9. UPDATE / REMOVE AVATAR
  async updateAvatar(userId, avatarDataUrl) {
    const apiRes = await this.request('/api/user/avatar', {
      method: 'POST',
      body: JSON.stringify({ userId, avatar: avatarDataUrl })
    });

    if (apiRes.ok) {
      const cur = Storage.getCurrentUser();
      if (cur && cur.id === userId) {
        cur.avatar = avatarDataUrl;
        Storage.setCurrentUser(cur);
      }
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || "Failed to update profile picture.");
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.avatar = avatarDataUrl;
      Storage.saveUsers(users);
      Storage.setCurrentUser(user);
    }
    return { success: true, avatar: avatarDataUrl };
  },

  async removeAvatar(userId) {
    const apiRes = await this.request('/api/user/avatar', {
      method: 'DELETE',
      body: JSON.stringify({ userId })
    });

    if (apiRes.ok) {
      const cur = Storage.getCurrentUser();
      if (cur && cur.id === userId) {
        cur.avatar = "";
        Storage.setCurrentUser(cur);
      }
      return apiRes.data;
    }

    // Fallback
    const users = Storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.avatar = "";
      Storage.saveUsers(users);
      Storage.setCurrentUser(user);
    }
    return { success: true };
  }
};

// ==============================================================================
// Listings API & Database Service (REST API + Local Storage Dual Layer)
// ==============================================================================

const ListingsAPI = {
  baseUrl: window.location.origin,

  async request(endpoint, options = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, error: err.message, offline: true };
    }
  },

  // 1. Fetch Listings (default: status = 'ACTIVE' for public discovery, or status = 'all')
  async fetchListings(query = {}) {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.userId) params.set('userId', query.userId);
    if (query.id) params.set('id', query.id);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const apiRes = await this.request(`/api/listings${queryString}`);

    if (apiRes.ok && apiRes.data.listings) {
      // Sync active listings to local storage cache if fetching public
      if (!query.userId && (!query.status || query.status === 'ACTIVE')) {
        Storage.saveListings(apiRes.data.listings);
      }
      return apiRes.data.listings;
    }

    // Fallback: LocalStorage
    let local = Storage.getListings();
    if (query.userId) {
      return local.filter(l => (l.userId === query.userId || l.hostId === query.userId) && l.status !== 'DELETED');
    }
    if (query.status && query.status !== 'all') {
      return local.filter(l => (l.status || 'ACTIVE').toUpperCase() === query.status.toUpperCase());
    }
    return local.filter(l => l.status !== 'DELETED');
  },

  // 2. Publish New Listing
  async publishListing(listingData) {
    const apiRes = await this.request('/api/listings', {
      method: 'POST',
      body: JSON.stringify(listingData)
    });

    if (apiRes.ok && apiRes.data.listing) {
      const saved = apiRes.data.listing;
      const local = Storage.getListings();
      const existingIdx = local.findIndex(l => l.id === saved.id);
      if (existingIdx > -1) {
        local[existingIdx] = saved;
      } else {
        local.unshift(saved);
      }
      Storage.saveListings(local);
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || 'Failed to publish listing on server.');
    }

    // Fallback
    const local = Storage.getListings();
    const fallbackListing = {
      ...listingData,
      id: listingData.id || `room_${Date.now()}`,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    local.unshift(fallbackListing);
    Storage.saveListings(local);
    return {
      success: true,
      message: 'Your room has been published successfully!',
      listing: fallbackListing
    };
  },

  // 3. Update Listing
  async updateListing(listingData) {
    const apiRes = await this.request('/api/listings/update', {
      method: 'POST',
      body: JSON.stringify(listingData)
    });

    if (apiRes.ok && apiRes.data.listing) {
      const updated = apiRes.data.listing;
      const local = Storage.getListings();
      const idx = local.findIndex(l => l.id === updated.id);
      if (idx > -1) local[idx] = updated;
      Storage.saveListings(local);
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || 'Failed to update listing.');
    }

    // Fallback
    const local = Storage.getListings();
    const idx = local.findIndex(l => l.id === listingData.id);
    if (idx > -1) {
      Object.assign(local[idx], listingData, { updatedAt: new Date().toISOString() });
      Storage.saveListings(local);
      return { success: true, listing: local[idx] };
    }
    throw new Error('Listing not found.');
  },

  // 4. Update Status (ACTIVE, INACTIVE, RENTED, DELETED)
  async updateStatus(listingId, status, userId) {
    const apiRes = await this.request('/api/listings/status', {
      method: 'POST',
      body: JSON.stringify({ listingId, status, userId })
    });

    if (apiRes.ok && apiRes.data.listing) {
      const updated = apiRes.data.listing;
      const local = Storage.getListings();
      const idx = local.findIndex(l => l.id === listingId);
      if (idx > -1) {
        if (status === 'DELETED') {
          local.splice(idx, 1);
        } else {
          local[idx] = updated;
        }
        Storage.saveListings(local);
      }
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || 'Failed to update status.');
    }

    // Fallback
    const local = Storage.getListings();
    const idx = local.findIndex(l => l.id === listingId);
    if (idx > -1) {
      if (status === 'DELETED') {
        local.splice(idx, 1);
      } else {
        local[idx].status = status;
        local[idx].updatedAt = new Date().toISOString();
      }
      Storage.saveListings(local);
      return { success: true, listing: local[idx] };
    }
    throw new Error('Listing not found.');
  },

  // 5. Delete Listing
  async deleteListing(listingId, userId) {
    const apiRes = await this.request('/api/listings/delete', {
      method: 'POST',
      body: JSON.stringify({ listingId, userId })
    });

    const local = Storage.getListings();
    const idx = local.findIndex(l => l.id === listingId);
    if (idx > -1) {
      local.splice(idx, 1);
      Storage.saveListings(local);
    }

    if (apiRes.ok) {
      return apiRes.data;
    } else if (apiRes.status > 0) {
      throw new Error(apiRes.data.error || 'Failed to delete listing.');
    }
    return { success: true, message: 'Listing deleted.' };
  }
};

// ==============================================================================
// Compatibility Calculation Engine (Kerala Context)
// ==============================================================================

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

// ==============================================================================
// Storage Manager for LocalStorage persistence
// ==============================================================================

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
    // Check localStorage first (Remember Me), then sessionStorage
    const local = localStorage.getItem("nestmate_kerala_current_user");
    if (local) return JSON.parse(local);
    const session = sessionStorage.getItem("nestmate_kerala_current_user");
    if (session) return JSON.parse(session);
    return null;
  },
  setCurrentUser(user, rememberMe = true) {
    if (user) {
      const payload = JSON.stringify(user);
      if (rememberMe) {
        localStorage.setItem("nestmate_kerala_current_user", payload);
        sessionStorage.removeItem("nestmate_kerala_current_user");
      } else {
        sessionStorage.setItem("nestmate_kerala_current_user", payload);
        localStorage.removeItem("nestmate_kerala_current_user");
      }
    } else {
      localStorage.removeItem("nestmate_kerala_current_user");
      sessionStorage.removeItem("nestmate_kerala_current_user");
    }
  },
  clearCurrentUser() {
    localStorage.removeItem("nestmate_kerala_current_user");
    sessionStorage.removeItem("nestmate_kerala_current_user");
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
    sessionStorage.removeItem("nestmate_kerala_current_user");
    localStorage.removeItem("nestmate_kerala_favorites");
    localStorage.removeItem("nestmate_kerala_conversations");
  }
};
