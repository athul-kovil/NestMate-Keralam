/**
 * NestMate Kerala - Core Application Controller
 * Tailored for Kerala, India (Kochi, Trivandrum, Calicut)
 * Starts with dedicated Login Page (Step 1) -> User Details Onboarding (Step 2) -> Room Explorer & Google Map
 */

class NestMateKeralaApp {
  constructor() {
    this.users = Storage.getUsers();
    this.listings = Storage.getListings();
    this.currentUser = Storage.getCurrentUser();
    this.favorites = Storage.getFavorites();
    this.conversations = Storage.getConversations();

    this.activeTab = 'all';
    this.layoutView = 'grid'; // 'grid' | 'map'
    this.sortMode = 'match_desc';
    this.quickFilters = new Set();
    this.advancedFilters = {
      smoking: 'any',
      drinking: 'any',
      shift: 'any',
      gender: 'any',
      maxRent: 30000
    };
    this.searchQuery = '';
    this.searchRoommates = 'all';
    this.searchBudget = null;

    this.activeConversationId = null;
    this.newListingPhotos = [];
    this.pageOtpSent = false;

    this.init();
  }

  init() {
    this.applyTheme(localStorage.getItem('nestmate_theme') || 'light');
    this.renderNavUser();
    this.renderFavCount();
    this.renderUnreadCount();
    this.renderPostPhotoPreviews();
    this.renderListings();

    // Default view: If user is not logged in, show dedicated Login Page first!
    if (!this.currentUser) {
      this.showLoginView();
    } else {
      this.showMainView();
    }

    // Check if URL has ?room=lst_id for direct promotion links
    const urlParams = new URLSearchParams(window.location.search);
    const sharedRoomId = urlParams.get('room');
    if (sharedRoomId) {
      this.showMainView();
      setTimeout(() => {
        this.openListingDetail(sharedRoomId);
      }, 300);
    }

    // Global click listener for dropdowns and modal backdrops
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('user-dropdown-menu');
      const btn = document.getElementById('user-menu-trigger');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }

      // Close modal on backdrop click
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => {
          m.classList.remove('open');
        });
        document.body.style.overflow = '';
      }
    });
  }

  /* ==========================================================================
     Top-Level Page View Switcher (Login Page vs Onboarding vs Main Explorer)
     ========================================================================== */

  showLoginView() {
    const loginView = document.getElementById('view-login-page');
    const onboardView = document.getElementById('view-onboarding-page');
    const mainView = document.getElementById('view-main-app');

    if (loginView) loginView.style.display = 'block';
    if (onboardView) onboardView.style.display = 'none';
    if (mainView) mainView.style.display = 'none';

    const loginNav = document.getElementById('nav-btn-login-page');
    const exploreNav = document.getElementById('nav-btn-explore');
    if (loginNav) loginNav.classList.add('active');
    if (exploreNav) exploreNav.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showOnboardingView() {
    const loginView = document.getElementById('view-login-page');
    const onboardView = document.getElementById('view-onboarding-page');
    const mainView = document.getElementById('view-main-app');

    if (loginView) loginView.style.display = 'none';
    if (onboardView) onboardView.style.display = 'block';
    if (mainView) mainView.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showMainView() {
    const loginView = document.getElementById('view-login-page');
    const onboardView = document.getElementById('view-onboarding-page');
    const mainView = document.getElementById('view-main-app');

    if (loginView) loginView.style.display = 'none';
    if (onboardView) onboardView.style.display = 'none';
    if (mainView) mainView.style.display = 'block';

    const loginNav = document.getElementById('nav-btn-login-page');
    const exploreNav = document.getElementById('nav-btn-explore');
    if (loginNav) loginNav.classList.remove('active');
    if (exploreNav) exploreNav.classList.add('active');

    this.renderListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     Page Login Handlers (Step 1: Mobile & Email)
     ========================================================================== */

  switchPageLoginMethod(method) {
    ['mobile', 'email', 'signup'].forEach(m => {
      const tab = document.getElementById(`page-tab-${m}`);
      const form = document.getElementById(`page-form-${m}`);
      if (tab) tab.classList.toggle('active', m === method);
      if (form) form.style.display = m === method ? 'block' : 'none';
    });
  }

  handlePageMobileLogin(event) {
    event.preventDefault();
    const phoneInput = document.getElementById('page-mobile-input').value.trim();
    const otpGroup = document.getElementById('page-otp-group');
    const submitBtn = document.getElementById('page-btn-mobile-submit');

    if (!this.pageOtpSent) {
      this.pageOtpSent = true;
      otpGroup.style.display = 'block';
      document.getElementById('page-otp-input').value = '1234';
      submitBtn.textContent = 'Verify OTP & Go to Step 2';
      this.showToast('📲 OTP sent to +91 ' + phoneInput + '! Demo code: 1234');
      return;
    }

    const otp = document.getElementById('page-otp-input').value.trim();
    if (otp !== '1234') {
      this.showToast('Please enter demo code: 1234');
      return;
    }

    let user = this.users.find(u => u.phone.includes(phoneInput));
    if (!user) {
      user = {
        id: `usr_${Date.now()}`,
        name: `User ${phoneInput.slice(-4)}`,
        phone: phoneInput,
        email: `user_${phoneInput.slice(-4)}@nestmate.in`,
        occupation: "Professional in Kerala",
        age: 24,
        gender: "Any",
        smoking: "no",
        drinking: "social",
        workingShift: "day",
        cleanliness: "high",
        budget: 7000,
        verified: true
      };
      this.users.push(user);
      Storage.saveUsers(this.users);
    }

    this.currentUser = user;
    Storage.setCurrentUser(user);
    this.renderNavUser();

    this.pageOtpSent = false;
    otpGroup.style.display = 'none';
    submitBtn.textContent = 'Continue with Mobile →';

    this.showToast(`🎉 Logged in! Step 2: Set your lifestyle details.`);
    this.showOnboardingView();
  }

  handlePageEmailLogin(event) {
    event.preventDefault();
    const email = document.getElementById('page-email-input').value.trim();
    let user = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = {
        id: `usr_${Date.now()}`,
        name: email.split('@')[0],
        phone: "98451 23456",
        email: email,
        occupation: "Professional in Kerala",
        age: 25,
        gender: "Any",
        smoking: "no",
        drinking: "social",
        workingShift: "day",
        cleanliness: "high",
        budget: 7000,
        verified: true
      };
      this.users.push(user);
      Storage.saveUsers(this.users);
    }

    this.currentUser = user;
    Storage.setCurrentUser(user);
    this.renderNavUser();
    this.showToast(`🎉 Welcome ${user.name}! Proceeding to details.`);
    this.showOnboardingView();
  }

  handlePageSignup(event) {
    event.preventDefault();

    const name = document.getElementById('page-signup-name').value.trim();
    const age = parseInt(document.getElementById('page-signup-age').value) || 24;
    const gender = document.getElementById('page-signup-gender').value;
    const email = document.getElementById('page-signup-email').value.trim();
    const phone = document.getElementById('page-signup-phone').value.trim();
    const occupation = document.getElementById('page-signup-occupation').value.trim();

    const newUser = {
      id: `usr_${Date.now()}`,
      name: name,
      email: email,
      phone: phone,
      age: age,
      gender: gender,
      occupation: occupation,
      smoking: "no",
      drinking: "social",
      workingShift: "day",
      cleanliness: "high",
      budget: 7000,
      verified: true
    };

    this.users.push(newUser);
    Storage.saveUsers(this.users);

    this.currentUser = newUser;
    Storage.setCurrentUser(newUser);
    this.renderNavUser();

    this.showToast(`🎉 Account created for ${name}! Please complete Step 2.`);
    this.showOnboardingView();
  }

  /* ==========================================================================
     Onboarding Handlers (Step 2: Details about User)
     ========================================================================== */

  handleSaveOnboardingDetails(event) {
    event.preventDefault();

    if (!this.currentUser) {
      this.currentUser = {
        id: `usr_${Date.now()}`,
        name: "User in Kerala",
        phone: "98451 23456",
        email: "user@nestmate.in",
        occupation: "Working Professional",
        verified: true
      };
    }

    this.currentUser.smoking = document.getElementById('onboard-smoking').value;
    this.currentUser.drinking = document.getElementById('onboard-drinking').value;
    this.currentUser.workingShift = document.getElementById('onboard-shift').value;
    this.currentUser.budget = parseFloat(document.getElementById('onboard-budget').value) || 7000;
    this.currentUser.cleanliness = document.getElementById('onboard-cleanliness').value;
    this.currentUser.diet = document.getElementById('onboard-diet').value;
    this.currentUser.bio = document.getElementById('onboard-bio').value.trim();

    Storage.setCurrentUser(this.currentUser);
    const userIdx = this.users.findIndex(u => u.id === this.currentUser.id);
    if (userIdx > -1) {
      this.users[userIdx] = this.currentUser;
    } else {
      this.users.push(this.currentUser);
    }
    Storage.saveUsers(this.users);

    this.renderNavUser();
    this.showToast('✅ Details saved! Welcome to NestMate Kerala.');
    this.showMainView();
  }

  /* ==========================================================================
     Theme & Nav State
     ========================================================================== */

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nestmate_theme', theme);
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      }
    }
  }

  renderNavUser() {
    const container = document.getElementById('nav-user-container');
    if (!container) return;

    if (this.currentUser) {
      container.innerHTML = `
        <div style="position: relative;">
          <button class="user-menu-btn" id="user-menu-trigger" onclick="app.toggleUserMenu()">
            <div class="user-avatar-sm" style="background:#059669; color:#fff; font-size: 0.85rem;">
              ${(this.currentUser.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style="text-align: left; line-height: 1.2;">
              <span style="font-size: 0.82rem; font-weight: 700; display: block; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${(this.currentUser.name || 'User').split(' ')[0]}
              </span>
              <span style="font-size: 0.68rem; color: var(--success); font-weight: 600;">● Active</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <div id="user-dropdown-menu" style="display: none; position: absolute; right: 0; top: 48px; width: 230px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); z-index: 60; padding: 8px 0;">
            <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-color);">
              <div style="font-weight: 700; font-size: 0.9rem;">${this.currentUser.name}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${this.currentUser.phone || this.currentUser.email}</div>
            </div>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px;" onclick="app.showOnboardingView()">
              👤 Edit Profile & Habits
            </button>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px;" onclick="app.showMainView(); app.switchTab('my-listings');">
              🏠 My Posted Rooms
            </button>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px;" onclick="app.openPostRoomModal()">
              ➕ Post New Room
            </button>
            <div style="border-top: 1px solid var(--border-color); margin: 4px 0;"></div>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px; color: var(--danger);" onclick="app.logout()">
              🚪 Sign Out
            </button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="app.showLoginView()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Login / Register
        </button>
      `;
    }
  }

  toggleUserMenu() {
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  }

  renderFavCount() {
    const badge = document.getElementById('nav-fav-count');
    if (badge) badge.textContent = this.favorites.length;
  }

  renderUnreadCount() {
    const badge = document.getElementById('nav-unread-count');
    if (!badge) return;
    const totalUnread = this.conversations.reduce((acc, c) => acc + (c.unread || 0), 0);
    if (totalUnread > 0) {
      badge.textContent = totalUnread;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ==========================================================================
     Real Photo Uploading (FileReader Base64)
     ========================================================================== */

  handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let loadedCount = 0;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.newListingPhotos.push(e.target.result);
        loadedCount++;
        if (loadedCount === files.length) {
          this.renderPostPhotoPreviews();
          this.showToast(`📸 ${files.length} room photos uploaded successfully!`);
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  }

  removePostPhoto(index) {
    this.newListingPhotos.splice(index, 1);
    this.renderPostPhotoPreviews();
  }

  renderPostPhotoPreviews() {
    const container = document.getElementById('post-photo-previews');
    if (!container) return;

    if (this.newListingPhotos.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.8rem; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          No photos added yet. Click above to upload real pictures of your room/flat.
        </div>
      `;
      return;
    }

    container.innerHTML = this.newListingPhotos.map((img, idx) => `
      <div class="photo-thumb">
        <img src="${img}" alt="Room Photo ${idx + 1}">
        <button type="button" class="photo-thumb-remove" onclick="app.removePostPhoto(${idx})">&times;</button>
      </div>
    `).join('');
  }

  /* ==========================================================================
     Direct Google Maps Integration
     ========================================================================== */

  updateFormMapPreview() {
    const loc = document.getElementById('post-location').value.trim();
    const addr = document.getElementById('post-address').value.trim();
    const query = [addr, loc, "Kerala, India"].filter(Boolean).join(', ');

    const iframe = document.getElementById('post-google-map-preview');
    if (iframe) {
      iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    }
  }

  focusGoogleMap(query) {
    const iframe = document.getElementById('main-google-map-iframe');
    const label = document.getElementById('map-current-query-text');
    const extBtn = document.getElementById('btn-open-external-gmap');

    if (iframe) {
      iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    }
    if (label) {
      label.innerHTML = `Showing: <strong>${query}</strong> on Google Maps`;
    }
    if (extBtn) {
      extBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
  }

  /* ==========================================================================
     Promotion & WhatsApp Sharing
     ========================================================================== */

  shareAppOnWhatsApp() {
    const url = window.location.href;
    const msg = `🌴 *NestMate Kerala* — Find roommates and shared flats in Kochi (Kakkanad Infopark), Trivandrum (Technopark), and Calicut (Cyberpark)!\n\n` +
      `Check available rooms or post your vacant room for free:\n${url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  }

  copyAppShareLink() {
    this.copyToClipboard(window.location.href, '📋 NestMate Kerala website link copied! Share it on WhatsApp & Telegram.');
  }

  shareListingOnWhatsApp(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${listing.id}`;
    const msg = `🏡 *Room / Roommate Available in ${listing.location}!*\n` +
      `📍 *Address:* ${listing.address}\n` +
      `💰 *Rent Split:* ₹${listing.rentSplit.toLocaleString('en-IN')}/month\n` +
      `👥 *Roommates Needed:* ${listing.roommatesNeeded}\n` +
      `🚭 *Habits:* ${listing.smokingRule === 'no' ? 'Non-Smoker' : 'Balcony smoking ok'} | ${listing.drinkingRule === 'no' ? 'Non-Drinker' : 'Social ok'}\n` +
      `📞 *Contact:* ${listing.host ? listing.host.phone : 'Check listing'}\n\n` +
      `👉 *View Photos, Google Map & Details:* ${shareUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  }

  copyListingShareText(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${listing.id}`;
    const text = `🏡 Room Available in ${listing.location} (Kerala)\nRent: ₹${listing.rentSplit.toLocaleString('en-IN')}/month | Roommates needed: ${listing.roommatesNeeded}\nAddress: ${listing.address}\nView full photos & Google Map: ${shareUrl}`;
    this.copyToClipboard(text, '📋 Room details & link copied! You can now paste in WhatsApp groups.');
  }

  /* ==========================================================================
     Filtering & Search
     ========================================================================== */

  handleSearchInput() {
    this.searchQuery = document.getElementById('search-location').value.trim().toLowerCase();
    this.searchRoommates = document.getElementById('search-roommates').value;
    const budgetVal = document.getElementById('search-budget').value;
    this.searchBudget = budgetVal ? parseFloat(budgetVal) : null;
    this.renderListings();
  }

  executeSearch() {
    this.handleSearchInput();
    const resultsSection = document.getElementById('listings-container');
    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  setQuickCity(city) {
    const locInput = document.getElementById('search-location');
    if (locInput) locInput.value = city;
    this.searchQuery = city.toLowerCase();
    this.renderListings();
    this.showToast(`Showing rooms near ${city}`);
    document.getElementById('listings-container').scrollIntoView({ behavior: 'smooth' });
  }

  toggleQuickFilter(tag, el) {
    if (this.quickFilters.has(tag)) {
      this.quickFilters.delete(tag);
      el.classList.remove('active');
    } else {
      this.quickFilters.add(tag);
      el.classList.add('active');
    }
    this.renderListings();
  }

  switchTab(tab) {
    this.activeTab = tab;
    ['all', 'private', 'shared', 'my-listings'].forEach(t => {
      const btn = document.getElementById(`tab-${t}`);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    if (this.layoutView === 'map') {
      this.setLayoutView('grid');
    }

    this.renderListings();
  }

  handleSortChange(value) {
    this.sortMode = value;
    this.renderListings();
  }

  setLayoutView(view) {
    this.layoutView = view;
    document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-map').classList.toggle('active', view === 'map');

    const listingsContainer = document.getElementById('listings-container');
    const mapWrapper = document.getElementById('map-view-wrapper');

    if (view === 'map') {
      listingsContainer.style.display = 'none';
      mapWrapper.style.display = 'block';
    } else {
      listingsContainer.style.display = 'grid';
      mapWrapper.style.display = 'none';
      this.renderListings();
    }
  }

  applyAdvancedFilters() {
    this.advancedFilters.smoking = document.getElementById('filter-smoking').value;
    this.advancedFilters.drinking = document.getElementById('filter-drinking').value;
    this.advancedFilters.shift = document.getElementById('filter-shift').value;
    this.advancedFilters.gender = document.getElementById('filter-gender').value;
    this.advancedFilters.maxRent = parseFloat(document.getElementById('filter-rent-slider').value);

    let activeCount = 0;
    if (this.advancedFilters.smoking !== 'any') activeCount++;
    if (this.advancedFilters.drinking !== 'any') activeCount++;
    if (this.advancedFilters.shift !== 'any') activeCount++;
    if (this.advancedFilters.gender !== 'any') activeCount++;
    if (this.advancedFilters.maxRent < 30000) activeCount++;

    const badge = document.getElementById('active-filter-badge');
    if (badge) {
      if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    this.renderListings();
    this.showToast('Filters applied');
  }

  resetFilters() {
    this.searchQuery = '';
    this.searchRoommates = 'all';
    this.searchBudget = null;
    this.quickFilters.clear();
    this.advancedFilters = {
      smoking: 'any',
      drinking: 'any',
      shift: 'any',
      gender: 'any',
      maxRent: 30000
    };

    const locInput = document.getElementById('search-location');
    if (locInput) locInput.value = '';
    const roomSelect = document.getElementById('search-roommates');
    if (roomSelect) roomSelect.value = 'all';
    const budInput = document.getElementById('search-budget');
    if (budInput) budInput.value = '';

    document.querySelectorAll('.quick-tag').forEach(tag => tag.classList.remove('active'));
    const badge = document.getElementById('active-filter-badge');
    if (badge) badge.style.display = 'none';

    this.activeTab = 'all';
    this.switchTab('all');
  }

  /* Compute and filter listings */
  getProcessedListings() {
    let result = [...this.listings];

    result = result.map(listing => {
      const host = this.users.find(u => u.id === listing.hostId) || {
        name: listing.hostName || "Host in Kerala",
        phone: listing.hostPhone || "98451 23456",
        email: listing.hostEmail || "host@nestmate.in",
        occupation: listing.hostOccupation || "Working Professional",
        verified: true
      };
      const matchData = calculateCompatibility(this.currentUser, listing, host);
      return {
        ...listing,
        host,
        matchData
      };
    });

    if (this.activeTab === 'private') {
      result = result.filter(item => item.roomType.toLowerCase().includes('private'));
    } else if (this.activeTab === 'shared') {
      result = result.filter(item => item.roomType.toLowerCase().includes('shared'));
    } else if (this.activeTab === 'my-listings') {
      if (!this.currentUser) return [];
      result = result.filter(item => item.hostId === this.currentUser.id);
    }

    if (this.searchQuery) {
      result = result.filter(item => 
        (item.location && item.location.toLowerCase().includes(this.searchQuery)) ||
        (item.neighborhood && item.neighborhood.toLowerCase().includes(this.searchQuery)) ||
        (item.title && item.title.toLowerCase().includes(this.searchQuery)) ||
        (item.address && item.address.toLowerCase().includes(this.searchQuery))
      );
    }

    if (this.searchRoommates !== 'all') {
      const count = parseInt(this.searchRoommates);
      result = result.filter(item => item.roommatesNeeded === count);
    }

    if (this.searchBudget) {
      result = result.filter(item => item.rentSplit <= this.searchBudget);
    }

    if (this.quickFilters.has('non-smoker')) {
      result = result.filter(item => item.smokingRule === 'no');
    }
    if (this.quickFilters.has('day-shift')) {
      result = result.filter(item => item.workingShiftPreference === 'day' || item.workingShiftPreference === 'any');
    }

    if (this.advancedFilters.smoking !== 'any') {
      result = result.filter(item => item.smokingRule === this.advancedFilters.smoking);
    }
    if (this.advancedFilters.drinking !== 'any') {
      result = result.filter(item => item.drinkingRule === this.advancedFilters.drinking);
    }
    if (this.advancedFilters.shift !== 'any') {
      result = result.filter(item => item.workingShiftPreference === this.advancedFilters.shift || item.workingShiftPreference === 'any');
    }
    if (this.advancedFilters.gender !== 'any') {
      result = result.filter(item => item.genderPreference === this.advancedFilters.gender || item.genderPreference === 'any');
    }
    if (this.advancedFilters.maxRent) {
      result = result.filter(item => item.rentSplit <= this.advancedFilters.maxRent);
    }

    if (this.sortMode === 'match_desc') {
      result.sort((a, b) => b.matchData.score - a.matchData.score);
    } else if (this.sortMode === 'price_asc') {
      result.sort((a, b) => a.rentSplit - b.rentSplit);
    } else if (this.sortMode === 'price_desc') {
      result.sort((a, b) => b.rentSplit - a.rentSplit);
    } else if (this.sortMode === 'newest') {
      result.reverse();
    }

    return result;
  }

  /* Render Listings Grid */
  renderListings() {
    const container = document.getElementById('listings-container');
    if (!container) return;

    const list = this.getProcessedListings();

    const countAll = document.getElementById('count-all');
    if (countAll) countAll.textContent = this.listings.length;
    
    const countText = document.getElementById('results-count-text');
    if (countText) {
      countText.innerHTML = `Showing <span>${list.length} ${list.length === 1 ? 'room' : 'rooms'}</span> in Kerala`;
    }

    // Fresh Empty State
    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 24px; background: var(--bg-surface); border: 2px dashed var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="font-size: 3.5rem; margin-bottom: 12px;">🌴</div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">
            Start Fresh: No rooms posted yet in Kerala!
          </h3>
          <p style="color: var(--text-muted); max-width: 540px; margin: 0 auto 24px; font-size: 0.95rem; line-height: 1.6;">
            Be the very first to post your room in Kakkanad Infopark, Technopark Trivandrum, Cyberpark Calicut, or anywhere in Kerala. You can upload real photos and share directly to WhatsApp!
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-lg" onclick="app.openPostRoomModal()">
              ➕ Post Your Room Now
            </button>
            <button class="btn btn-whatsapp btn-lg" onclick="app.shareAppOnWhatsApp()">
              📲 Share on WhatsApp
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => this.createListingCardHTML(item)).join('');
  }

  createListingCardHTML(item) {
    const isFav = this.favorites.includes(item.id);
    const host = item.host;
    const match = item.matchData;
    const firstImg = item.images && item.images.length > 0 ? item.images[0] : KERALA_ROOM_SVG;

    const smokeTag = item.smokingRule === 'no' 
      ? '<span class="life-chip match-good">🚭 Non-Smoker</span>' 
      : '<span class="life-chip">💨 Balcony Smoke</span>';

    const drinkTag = item.drinkingRule === 'no'
      ? '<span class="life-chip match-good">🚫 Non-Drinker</span>'
      : '<span class="life-chip">🍷 Social Drinks</span>';

    const shiftTag = item.workingShiftPreference === 'wfh'
      ? '<span class="life-chip">💻 WFH Friendly</span>'
      : '<span class="life-chip">💼 Day Shift</span>';

    return `
      <div class="listing-card" id="card-${item.id}">
        <div class="card-media">
          <img src="${firstImg}" class="card-img" alt="${item.title}" onerror="this.src='${KERALA_ROOM_SVG}'">
          
          <div class="card-badges-top">
            <div class="match-badge ${match.tier}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              ${match.score}% Match
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="app.toggleFavorite('${item.id}', event)" title="Save Room">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
          </div>

          <div class="card-badges-bottom">
            <span class="pill-badge">📷 ${item.images ? item.images.length : 0} Photos</span>
            <span class="pill-badge">🚪 ${item.roomType}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-price-row">
            <div class="card-price">
              ₹${item.rentSplit.toLocaleString('en-IN')} <small>/ month</small>
            </div>
            <div class="roommates-needed-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ${item.roommatesNeeded} needed
            </div>
          </div>

          <h3 class="card-title" title="${item.title}">${item.title}</h3>

          <div class="card-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${item.location}
          </div>

          <div class="lifestyle-chips">
            ${smokeTag}
            ${drinkTag}
            ${shiftTag}
          </div>

          <div class="card-footer">
            <div class="host-mini" title="Host: ${host ? host.name : 'Host'}">
              <div class="host-avatar" style="display:flex; align-items:center; justify-content:center; background:#059669; color:#fff; font-weight:700;">
                ${(host && host.name ? host.name : 'H').charAt(0).toUpperCase()}
              </div>
              <div class="host-info">
                <div class="host-name">
                  ${(host && host.name ? host.name : 'Host').split(' ')[0]}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <div class="host-work">${(host && host.occupation ? host.occupation : 'Host in Kerala').split('@')[0]}</div>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn btn-outline btn-sm" onclick="app.openListingDetail('${item.id}')">
                Details & Map
              </button>
              <button class="btn btn-whatsapp btn-sm" onclick="app.shareListingOnWhatsApp('${item.id}')" title="Share to WhatsApp">
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  toggleFavorite(id, event) {
    if (event) event.stopPropagation();
    const index = this.favorites.indexOf(id);
    if (index > -1) {
      this.favorites.splice(index, 1);
      this.showToast('Removed from saved rooms');
    } else {
      this.favorites.push(id);
      this.showToast('❤️ Saved to your favorite rooms!');
    }
    Storage.saveFavorites(this.favorites);
    this.renderFavCount();
    this.renderListings();
  }

  /* ==========================================================================
     Listing Details Modal (With Direct Google Maps Embed)
     ========================================================================== */

  openListingDetail(id) {
    const listing = this.listings.find(l => l.id === id);
    if (!listing) return;

    const host = this.users.find(u => u.id === listing.hostId) || {
      name: listing.hostName || "Host in Kerala",
      phone: listing.hostPhone || "98451 23456",
      email: listing.hostEmail || "host@nestmate.in",
      occupation: listing.hostOccupation || "Working Professional",
      verified: true
    };
    const match = calculateCompatibility(this.currentUser, listing, host);

    const titleEl = document.getElementById('detail-modal-title');
    if (titleEl) titleEl.textContent = listing.title;

    const bodyEl = document.getElementById('detail-modal-body');
    if (!bodyEl) return;

    const images = listing.images && listing.images.length > 0 ? listing.images : [KERALA_ROOM_SVG];
    const galleryThumbsHTML = images.map((img) => `
      <img src="${img}" onclick="document.getElementById('main-detail-img').src=this.src" style="cursor: pointer; height: 75px; width: 100%; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
    `).join('');

    const amenitiesHTML = (listing.amenities || []).map(am => `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; padding: 6px 10px; background: var(--bg-surface-alt); border-radius: var(--radius-sm);">
        <span style="color: var(--primary); font-weight: bold;">✔</span> ${am}
      </div>
    `).join('');

    const gmapQuery = encodeURIComponent(`${listing.address || ''}, ${listing.location || ''}, Kerala, India`);
    const gmapEmbedUrl = `https://maps.google.com/maps?q=${gmapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    const gmapExternalUrl = `https://www.google.com/maps/search/?api=1&query=${gmapQuery}`;
    const gmapDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gmapQuery}`;

    bodyEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 12px; margin-bottom: 24px;">
        <div style="height: 340px; border-radius: var(--radius-md); overflow: hidden; background: #000;">
          <img src="${images[0]}" id="main-detail-img" alt="Room Photo" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 340px; overflow-y: auto;">
          ${galleryThumbsHTML}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">
            ₹${listing.rentSplit.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">/ month per person</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Location: <strong>${listing.address}</strong>, ${listing.location}
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span class="pill-badge" style="background: var(--primary-light); color: var(--primary); font-size: 0.85rem; padding: 6px 12px;">
            👥 ${listing.roommatesNeeded} Roommate Needed
          </span>
          <span class="pill-badge" style="background: var(--success-light); color: var(--success-dark); font-size: 0.85rem; padding: 6px 12px;">
            📅 ${listing.availableFrom || 'Immediate'}
          </span>
        </div>
      </div>

      <!-- DIRECT GOOGLE MAP INTEGRATION -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
          📍 Direct Google Map Location
        </h4>
        <div class="google-map-wrapper">
          <iframe class="google-map-iframe" src="${gmapEmbedUrl}" allowfullscreen="" loading="lazy"></iframe>
          <div class="google-map-bar">
            <span style="font-size: 0.85rem; color: var(--text-muted);">
              Address: <strong>${listing.address}, ${listing.location}</strong>
            </span>
            <div style="display: flex; gap: 8px;">
              <a href="${gmapExternalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
                🗺️ Open in Google Maps
              </a>
              <a href="${gmapDirectionsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary">
                🚗 Get Directions
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- House Rules & Habits -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px;">House Rules & Character</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          <div class="compat-item">
            <span>🚭</span>
            <div>
              <strong>Smoking Policy</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                ${listing.smokingRule === 'no' ? 'Strictly Non-Smoking' : 'Allowed on Balcony Only'}
              </div>
            </div>
          </div>
          <div class="compat-item">
            <span>🍷</span>
            <div>
              <strong>Drinking Policy</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                ${listing.drinkingRule === 'no' ? 'Strictly Non-Drinking' : 'Social Drinking Welcome'}
              </div>
            </div>
          </div>
          <div class="compat-item">
            <span>💼</span>
            <div>
              <strong>Work Routine</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                ${listing.workingShiftPreference === 'day' ? 'Day Shift Preferred' : (listing.workingShiftPreference === 'wfh' ? 'WFH Friendly' : 'Flexible Hours')}
              </div>
            </div>
          </div>
          <div class="compat-item">
            <span>🚻</span>
            <div>
              <strong>Gender Preference</strong>
              <div style="font-size: 0.78rem; color: var(--text-muted);">
                ${(listing.genderPreference || 'Any').toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">About the Room & Space</h4>
        <p style="color: var(--text-muted); line-height: 1.6; font-size: 0.95rem;">
          ${listing.description || 'No detailed description provided.'}
        </p>
      </div>

      <!-- Amenities -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px;">Included Amenities</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
          ${amenitiesHTML}
        </div>
      </div>

      <!-- Host Profile, Direct Contact & WhatsApp Share -->
      <div class="host-profile-box">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #059669; color: #fff; font-size: 1.2rem; font-weight: bold; display: flex; align-items: center; justify-content: center;">
              ${(host.name || 'H').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                ${host.name}
                <span class="brand-badge" style="background: var(--success-light); color: var(--success-dark);">✓ Verified Kerala Host</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                ${host.occupation || 'Working Professional'}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-whatsapp" onclick="app.shareListingOnWhatsApp('${listing.id}')">
              📲 Share on WhatsApp
            </button>
            <button class="btn btn-primary" onclick="app.startChatWithHost('${listing.hostId || 'host_1'}', '${listing.id}'); app.closeModal('modal-listing-detail');">
              💬 In-App Chat
            </button>
          </div>
        </div>

        <div class="contact-reveal-area">
          <div class="contact-item">
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Direct Mobile / WhatsApp</div>
              <div style="font-weight: 700; font-size: 0.95rem;">+91 ${host.phone}</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <a href="tel:${host.phone.replace(/[^0-9]/g, '')}" class="btn btn-sm btn-secondary">
                📞 Call
              </a>
              <a href="https://wa.me/91${host.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi, I saw your room listing in ' + listing.location + ' on NestMate Kerala!')}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">
                WhatsApp
              </a>
            </div>
          </div>

          <div class="contact-item">
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Email Address</div>
              <div style="font-weight: 700; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${host.email}</div>
            </div>
            <div style="display: flex; gap: 6px;">
              <a href="mailto:${host.email}?subject=Interested in your room in ${encodeURIComponent(listing.location)}" class="btn btn-sm btn-secondary">
                ✉️ Email
              </a>
              <button class="btn btn-sm btn-outline" onclick="app.copyListingShareText('${listing.id}')" title="Copy Details to Share">
                📋 Copy Info
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.openModal('modal-listing-detail');
  }

  copyToClipboard(text, msg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.showToast(msg);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast(msg);
    }
  }

  /* ==========================================================================
     Post a Room Listing
     ========================================================================== */

  openPostRoomModal() {
    if (!this.currentUser) {
      this.showToast('Please sign in or register to post your room!');
      this.showLoginView();
      return;
    }
    this.openModal('modal-post-room');
  }

  handleCreateListing(event) {
    event.preventDefault();

    const title = document.getElementById('post-title').value.trim();
    const roomType = document.getElementById('post-room-type').value;
    const location = document.getElementById('post-location').value.trim();
    const address = document.getElementById('post-address').value.trim();
    const rentSplit = parseFloat(document.getElementById('post-rent-split').value);
    const roommatesNeeded = parseInt(document.getElementById('post-roommates-needed').value);
    const deposit = parseFloat(document.getElementById('post-deposit').value) || rentSplit * 2;
    const availableFrom = document.getElementById('post-available-date').value || 'Immediate';
    const smokingRule = document.getElementById('post-smoking-rule').value;
    const drinkingRule = document.getElementById('post-drinking-rule').value;
    const shiftPref = document.getElementById('post-shift-preference').value;
    const genderPref = document.getElementById('post-gender-preference').value;
    const description = document.getElementById('post-description').value.trim();

    const amenities = [];
    document.querySelectorAll('.amenity-checkbox input:checked').forEach(cb => {
      amenities.push(cb.value);
    });

    const newListing = {
      id: `lst_${Date.now()}`,
      hostId: this.currentUser.id,
      hostName: this.currentUser.name,
      hostPhone: this.currentUser.phone,
      hostEmail: this.currentUser.email,
      hostOccupation: this.currentUser.occupation,
      title: title,
      propertyType: "Apartment",
      roomType: roomType,
      location: location,
      neighborhood: location.split(',')[0],
      address: address,
      city: "Kerala",
      totalRent: rentSplit * (roommatesNeeded + 1),
      rentSplit: rentSplit,
      currency: "₹",
      deposit: deposit,
      billsIncluded: true,
      roommatesNeeded: roommatesNeeded,
      genderPreference: genderPref,
      availableFrom: availableFrom,
      smokingRule: smokingRule,
      drinkingRule: drinkingRule,
      workingShiftPreference: shiftPref,
      petPolicy: "yes",
      cleanlinessExpectation: "high",
      amenities: amenities.length > 0 ? amenities : ["High-Speed WiFi", "Washing Machine"],
      images: this.newListingPhotos.length > 0 ? [...this.newListingPhotos] : [KERALA_ROOM_SVG],
      description: description,
      postedDate: "Just now",
      status: "active"
    };

    this.listings.unshift(newListing);
    Storage.saveListings(this.listings);

    this.newListingPhotos = [];
    this.renderPostPhotoPreviews();

    this.closeModal('modal-post-room');
    this.showToast('🎉 Your room in Kerala is published live!');
    this.showMainView();
    this.switchTab('my-listings');
  }

  logout() {
    this.currentUser = null;
    Storage.setCurrentUser(null);
    this.renderNavUser();
    this.showToast('Signed out successfully.');
    this.showLoginView();
  }

  togglePasswordVisibility(inputId) {
    const el = document.getElementById(inputId);
    if (el) {
      el.type = el.type === 'password' ? 'text' : 'password';
    }
  }

  /* ==========================================================================
     In-App Messenger
     ========================================================================== */

  openChatModal(conversationId = null) {
    if (!this.currentUser) {
      this.showToast('Please sign in to send messages');
      this.showLoginView();
      return;
    }
    this.renderChatThreadList();
    if (conversationId) {
      this.selectChatThread(conversationId);
    } else if (this.conversations.length > 0) {
      this.selectChatThread(this.conversations[0].id);
    }
    this.openModal('modal-chat');
  }

  startChatWithHost(hostId, listingId) {
    if (!this.currentUser) {
      this.showToast('Please sign in to chat with the host');
      this.showLoginView();
      return;
    }

    let conv = this.conversations.find(c => c.listingId === listingId);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}`,
        participantId: hostId,
        listingId: listingId,
        lastMessage: "Namaskaram! Is this room still open?",
        lastTime: "Just now",
        unread: 0,
        messages: [
          {
            id: `m_${Date.now()}`,
            senderId: this.currentUser.id,
            text: "Namaskaram! I saw your room listing on NestMate Kerala. Is this spot available for rent?",
            time: "Just now",
            status: "sent"
          }
        ]
      };
      this.conversations.unshift(conv);
      Storage.saveConversations(this.conversations);
    }

    this.openChatModal(conv.id);
  }

  renderChatThreadList() {
    const listEl = document.getElementById('chat-thread-list');
    if (!listEl) return;

    if (this.conversations.length === 0) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No messages yet. Click 'In-App Chat' on any room listing to message a host!</div>`;
      return;
    }

    listEl.innerHTML = this.conversations.map(conv => {
      const listing = this.listings.find(l => l.id === conv.listingId);
      const isActive = conv.id === this.activeConversationId;
      return `
        <div class="chat-thread ${isActive ? 'active' : ''}" onclick="app.selectChatThread('${conv.id}')">
          <div style="width: 38px; height: 38px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
            🏠
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: 700; font-size: 0.88rem;">${listing ? listing.location : 'Room in Kerala'}</span>
              <span style="font-size: 0.7rem; color: var(--text-muted);">${conv.lastTime}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${conv.lastMessage}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  selectChatThread(conversationId) {
    this.activeConversationId = conversationId;
    const conv = this.conversations.find(c => c.id === conversationId);
    if (!conv) return;

    conv.unread = 0;
    Storage.saveConversations(this.conversations);
    this.renderUnreadCount();
    this.renderChatThreadList();

    const listing = this.listings.find(l => l.id === conv.listingId);

    const headerEl = document.getElementById('chat-active-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-weight: 700; font-size: 0.95rem;">
            ${listing ? listing.title : 'Kerala Room Inquiry'}
            <div style="font-size: 0.72rem; color: var(--success); font-weight: 600;">● Active in Kerala</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          ${listing ? `<button class="btn btn-sm btn-outline" onclick="app.openListingDetail('${listing.id}')">View Details & Map</button>` : ''}
        </div>
      `;
    }

    this.renderChatMessages(conv);
  }

  renderChatMessages(conv) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = conv.messages.map(msg => {
      const isMe = msg.senderId === (this.currentUser ? this.currentUser.id : null);
      return `
        <div class="msg ${isMe ? 'sent' : 'received'}">
          ${msg.text}
          <div class="msg-time">${msg.time}</div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  handleSendMessage(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('chat-input-field');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    this.sendDirectMessage(text);
    input.value = '';
  }

  sendQuickMessage(text) {
    this.sendDirectMessage(text);
  }

  sendDirectMessage(text) {
    if (!this.activeConversationId) return;
    const conv = this.conversations.find(c => c.id === this.activeConversationId);
    if (!conv) return;

    const newMsg = {
      id: `m_${Date.now()}`,
      senderId: this.currentUser ? this.currentUser.id : 'me',
      text: text,
      time: "Just now",
      status: "sent"
    };

    conv.messages.push(newMsg);
    conv.lastMessage = text;
    conv.lastTime = "Just now";
    Storage.saveConversations(this.conversations);

    this.renderChatMessages(conv);
    this.renderChatThreadList();

    setTimeout(() => {
      const responses = [
        "Namaskaram! Yes, the room is currently open. Let's arrange a time for you to visit this weekend!",
        "Hello! Glad to see your inquiry. The flat is very close to Infopark / Technopark and has good transport access.",
        "Hi! Yes, high-speed WiFi and water/maintenance are split equally among flatmates. Feel free to WhatsApp me as well!"
      ];
      const reply = {
        id: `m_rep_${Date.now()}`,
        senderId: conv.participantId,
        text: responses[Math.floor(Math.random() * responses.length)],
        time: "Just now",
        status: "read"
      };

      conv.messages.push(reply);
      conv.lastMessage = reply.text;
      conv.lastTime = "Just now";
      Storage.saveConversations(this.conversations);

      this.renderChatMessages(conv);
      this.renderChatThreadList();
      this.showToast('💬 New reply from room host in Kerala!');
    }, 1500);
  }

  /* ==========================================================================
     Modal Helpers & Notifications
     ========================================================================== */

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  openFiltersModal() {
    this.openModal('modal-filters');
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span>🔔</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Global Application Instance
const app = new NestMateKeralaApp();
