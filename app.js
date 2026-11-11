/**
 * NestMate Kerala - Ultra-Modern Application Controller
 * Tailored for Kerala, India (Kochi, Trivandrum, Calicut)
 * Featuring Interactive Photo Carousel, Photo Sharing, Google Maps,
 * and Smooth Modal Scrolling.
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
    this.coverPhotoIndex = 0;
    this.editingListingId = null;
    this.lightboxPhotos = [];
    this.lightboxActiveIdx = 0;
    this.isLoadingListings = false;
    
    // Modern Auth & Profile State
    this.pendingVerificationEmail = null;
    this.verificationCountdownInterval = null;
    this.registerAvatarData = "";
    this.profileModalAvatarData = "";

    // Track active photo index in listing detail modal
    this.detailActivePhotoIdx = 0;
    this.detailActiveListing = null;

    // Card photo carousel indices
    this.cardPhotoIndices = {};

    this.init();
  }

  init() {
    this.applyTheme(localStorage.getItem('nestmate_theme') || 'light');
    this.renderNavUser();
    this.renderFavCount();
    this.renderUnreadCount();
    this.renderPostPhotoPreviews();
    this.renderListings();
    this.loadListingsFromBackend();

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

    // Escape key closes modals, Arrow keys navigate lightbox
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach(m => {
          m.classList.remove('open');
        });
        const lb = document.getElementById('modal-image-lightbox');
        if (lb) lb.classList.remove('open');
        document.body.style.overflow = '';
      }
      if (e.key === 'ArrowLeft' && this.lightboxPhotos.length > 0) {
        const lb = document.getElementById('modal-image-lightbox');
        if (lb && lb.classList.contains('open')) this.prevLightboxPhoto();
      }
      if (e.key === 'ArrowRight' && this.lightboxPhotos.length > 0) {
        const lb = document.getElementById('modal-image-lightbox');
        if (lb && lb.classList.contains('open')) this.nextLightboxPhoto();
      }
    });

    // Setup drag-and-drop for photo uploader
    this.setupDragAndDrop();
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

    if (!this.pendingVerificationEmail) {
      this.switchAuthTab('login');
    }

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
     Modern Authentication Handlers (Gmail & Password with PBKDF2 Hashing)
     ========================================================================== */

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('page-form-login');
    const formRegister = document.getElementById('page-form-register');
    const boxVerify = document.getElementById('page-box-verification');
    const headerTitle = document.getElementById('auth-title');
    const headerSubtitle = document.getElementById('auth-subtitle');
    const guestBox = document.getElementById('auth-guest-browse-box');

    if (tabLogin) tabLogin.classList.toggle('active', tab === 'login');
    if (tabRegister) tabRegister.classList.toggle('active', tab === 'register');

    if (formLogin) formLogin.style.display = tab === 'login' ? 'block' : 'none';
    if (formRegister) formRegister.style.display = tab === 'register' ? 'block' : 'none';
    if (boxVerify) boxVerify.style.display = 'none';
    if (guestBox) guestBox.style.display = 'block';

    const authTabs = document.querySelector('.auth-nav-tabs');
    if (authTabs) authTabs.style.display = 'flex';

    if (headerTitle && headerSubtitle) {
      if (tab === 'login') {
        headerTitle.textContent = 'Welcome to NestMate';
        headerSubtitle.textContent = 'Sign in using your registered Gmail address and password:';
      } else {
        headerTitle.textContent = 'Create Your NestMate Account';
        headerSubtitle.textContent = 'Join Kerala’s roommate network with secure Gmail verification:';
      }
    }
  }

  /* Form Validations */

  validateLoginGmail() {
    const input = document.getElementById('login-gmail-input');
    const feedback = document.getElementById('login-gmail-feedback');
    if (!input || !feedback) return;
    const val = input.value.trim();
    if (!val) {
      feedback.textContent = '';
      return;
    }
    if (CryptoAuth.isValidGmail(val)) {
      feedback.className = 'form-feedback valid';
      feedback.textContent = '✅ Valid Gmail address';
    } else {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Must be a valid @gmail.com address';
    }
  }

  validateRegisterGmail() {
    const input = document.getElementById('register-gmail');
    const feedback = document.getElementById('register-gmail-feedback');
    if (!input || !feedback) return;
    const val = input.value.trim();
    if (!val) {
      feedback.textContent = '';
      return;
    }
    if (CryptoAuth.isValidGmail(val)) {
      feedback.className = 'form-feedback valid';
      feedback.textContent = '✅ Valid Gmail address';
    } else {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Only @gmail.com addresses are accepted';
    }
  }

  validateRegisterRecovery() {
    const gmailInput = document.getElementById('register-gmail');
    const recInput = document.getElementById('register-recovery-email');
    const feedback = document.getElementById('register-recovery-feedback');
    if (!recInput || !feedback) return;
    const recVal = recInput.value.trim();
    const gVal = gmailInput ? gmailInput.value.trim() : '';

    if (!recVal) {
      feedback.textContent = '';
      return;
    }

    if (!CryptoAuth.isValidEmail(recVal)) {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Please enter a valid email format';
      return;
    }

    if (gVal && recVal.toLowerCase() === gVal.toLowerCase()) {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Recovery email must be different from your Gmail address';
      return;
    }

    feedback.className = 'form-feedback valid';
    feedback.textContent = '✅ Valid recovery email';
  }

  handleRegisterPasswordInput() {
    const pwdInput = document.getElementById('register-password');
    if (!pwdInput) return;
    const pwd = pwdInput.value;
    const strength = CryptoAuth.evaluatePasswordStrength(pwd);

    const fill = document.getElementById('register-pwd-strength-fill');
    const label = document.getElementById('register-pwd-strength-label');

    if (fill) {
      fill.style.width = `${strength.percent}%`;
      fill.className = `strength-bar-fill ${strength.class}`;
    }
    if (label) {
      label.textContent = strength.label;
      label.style.color = strength.class === 'strong' ? 'var(--success)' : (strength.class === 'good' ? '#3b82f6' : (strength.class === 'fair' ? '#f59e0b' : '#ef4444'));
    }

    // Requirements checklist
    const reqs = strength.checks || {};
    this.setReqStatus('req-len', reqs.length);
    this.setReqStatus('req-upper', reqs.uppercase);
    this.setReqStatus('req-lower', reqs.lowercase);
    this.setReqStatus('req-num', reqs.number);
    this.setReqStatus('req-sym', reqs.special);

    this.validatePasswordMatch();
  }

  setReqStatus(elId, isValid) {
    const el = document.getElementById(elId);
    if (el) {
      el.className = isValid ? 'valid' : '';
    }
  }

  validatePasswordMatch() {
    const pwd = document.getElementById('register-password');
    const confirm = document.getElementById('register-confirm-password');
    const feedback = document.getElementById('register-confirm-feedback');
    if (!pwd || !confirm || !feedback) return;

    if (!confirm.value) {
      feedback.textContent = '';
      return;
    }

    if (pwd.value === confirm.value) {
      feedback.className = 'form-feedback valid';
      feedback.textContent = '✅ Passwords match';
    } else {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Passwords do not match';
    }
  }

  /* Circular Avatar Selection (JPG, PNG, WEBP, Max 5MB) */

  handleAvatarFileSelect(event, context = 'register') {
    const file = event.target.files[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.showToast('⚠️ Please upload a valid image (JPG, PNG, or WEBP).');
      event.target.value = '';
      return;
    }

    // Validate size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast('⚠️ Image file is too large! Please choose an image under 5MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (context === 'register') {
        this.registerAvatarData = dataUrl;
        const img = document.getElementById('register-avatar-img');
        if (img) img.src = dataUrl;
        const removeBtn = document.getElementById('register-avatar-remove-btn');
        if (removeBtn) removeBtn.style.display = 'inline-block';
        this.showToast('📸 Profile picture selected!');
      } else if (context === 'profile') {
        this.profileModalAvatarData = dataUrl;
        const img = document.getElementById('profile-modal-avatar-img');
        if (img) img.src = dataUrl;
        const removeBtn = document.getElementById('profile-modal-avatar-remove-btn');
        if (removeBtn) removeBtn.style.display = 'inline-block';
        this.showToast('📸 Profile picture updated in preview!');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  removeAvatarPhoto(context = 'register') {
    if (context === 'register') {
      this.registerAvatarData = '';
      const img = document.getElementById('register-avatar-img');
      if (img) img.src = DEFAULT_AVATAR_SVG;
      const removeBtn = document.getElementById('register-avatar-remove-btn');
      if (removeBtn) removeBtn.style.display = 'none';
      this.showToast('Profile photo removed.');
    } else if (context === 'profile') {
      this.profileModalAvatarData = '';
      const img = document.getElementById('profile-modal-avatar-img');
      if (img) img.src = DEFAULT_AVATAR_SVG;
      const removeBtn = document.getElementById('profile-modal-avatar-remove-btn');
      if (removeBtn) removeBtn.style.display = 'none';
      this.showToast('Profile photo removed in preview.');
    }
  }

  /* Registration Submission */

  async handlePageRegister(event) {
    event.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-gmail').value.trim().toLowerCase();
    const recoveryEmail = document.getElementById('register-recovery-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const age = parseInt(document.getElementById('register-age').value) || 25;
    const gender = document.getElementById('register-gender').value;
    const occupation = (document.getElementById('register-occupation').value || '').trim() || 'Working Professional in Kerala';

    if (!name) {
      this.showToast('⚠️ Please enter your full name.');
      return;
    }

    if (!CryptoAuth.isValidGmail(email)) {
      this.showToast('⚠️ Please enter a valid Gmail address (ending in @gmail.com).');
      return;
    }

    if (!CryptoAuth.isValidEmail(recoveryEmail)) {
      this.showToast('⚠️ Please enter a valid recovery email address.');
      return;
    }

    if (email === recoveryEmail) {
      this.showToast('⚠️ Recovery email must be different from your primary Gmail address.');
      return;
    }

    if (password.length < 8) {
      this.showToast('⚠️ Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      this.showToast('⚠️ Passwords do not match.');
      return;
    }

    const submitBtn = document.getElementById('btn-register-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Account & Verifying...';
    }

    try {
      const res = await AuthAPI.register({
        name,
        email,
        password,
        confirmPassword,
        recoveryEmail,
        avatar: this.registerAvatarData,
        age,
        gender,
        occupation
      });

      this.showVerificationScreen(email, res.verificationCode);
      this.showToast('🎉 Account created! A 6-digit verification code has been generated.');
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register & Send Verification Code →';
      }
    }
  }

  /* Email Verification Step */

  showVerificationScreen(email, demoCode) {
    this.pendingVerificationEmail = email;

    const formLogin = document.getElementById('page-form-login');
    const formRegister = document.getElementById('page-form-register');
    const boxVerify = document.getElementById('page-box-verification');
    const emailDisplay = document.getElementById('verify-email-display');
    const codeDisplay = document.getElementById('verify-demo-code-text');
    const authTabs = document.querySelector('.auth-nav-tabs');
    const guestBox = document.getElementById('auth-guest-browse-box');

    if (formLogin) formLogin.style.display = 'none';
    if (formRegister) formRegister.style.display = 'none';
    if (authTabs) authTabs.style.display = 'none';
    if (guestBox) guestBox.style.display = 'none';
    if (boxVerify) boxVerify.style.display = 'block';

    if (emailDisplay) emailDisplay.textContent = email;
    if (codeDisplay) codeDisplay.textContent = demoCode || '123456';

    const codeInput = document.getElementById('verify-code-input');
    if (codeInput) {
      codeInput.value = '';
      codeInput.focus();
    }

    this.startVerificationCountdown(15 * 60);
  }

  startVerificationCountdown(seconds = 900) {
    if (this.verificationCountdownInterval) {
      clearInterval(this.verificationCountdownInterval);
    }

    let remaining = seconds;
    const timerEl = document.getElementById('verify-countdown-timer');

    const updateTimer = () => {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      if (timerEl) {
        timerEl.innerHTML = `⏱ Code expires in: <strong>${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}</strong>`;
      }
      if (remaining <= 0) {
        clearInterval(this.verificationCountdownInterval);
        if (timerEl) {
          timerEl.innerHTML = `<span style="color:var(--danger); font-weight:700;">⚠️ Code expired. Click Resend Code.</span>`;
        }
      }
      remaining--;
    };

    updateTimer();
    this.verificationCountdownInterval = setInterval(updateTimer, 1000);
  }

  autofillVerificationCode() {
    const demoCode = document.getElementById('verify-demo-code-text');
    const input = document.getElementById('verify-code-input');
    if (demoCode && input) {
      input.value = demoCode.textContent.trim();
      this.showToast('Verification code autofilled!');
    }
  }

  async handleVerifyEmailSubmit(event) {
    event.preventDefault();
    const codeInput = document.getElementById('verify-code-input');
    const code = codeInput ? codeInput.value.trim() : '';

    if (!code || code.length < 6) {
      this.showToast('⚠️ Please enter the full 6-digit verification code.');
      return;
    }

    try {
      const res = await AuthAPI.verifyEmail(this.pendingVerificationEmail, code);
      if (this.verificationCountdownInterval) {
        clearInterval(this.verificationCountdownInterval);
      }

      this.currentUser = res.user;
      this.users = Storage.getUsers();
      this.renderNavUser();

      const authTabs = document.querySelector('.auth-nav-tabs');
      if (authTabs) authTabs.style.display = 'flex';

      this.pendingVerificationEmail = null;
      this.showToast('🎉 Gmail verified successfully! Welcome to NestMate.');
      this.showOnboardingView();
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  async handleResendVerificationCode() {
    if (!this.pendingVerificationEmail) return;

    try {
      const res = await AuthAPI.resendVerificationCode(this.pendingVerificationEmail);
      const codeDisplay = document.getElementById('verify-demo-code-text');
      if (codeDisplay && res.verificationCode) {
        codeDisplay.textContent = res.verificationCode;
      }
      this.startVerificationCountdown(15 * 60);
      this.showToast(`📨 Fresh 6-digit code sent to ${this.pendingVerificationEmail}!`);
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  /* Login Handlers */

  async handlePageLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-gmail-input').value.trim().toLowerCase();
    const password = document.getElementById('login-password-input').value;
    const rememberMe = document.getElementById('login-remember-me') ? document.getElementById('login-remember-me').checked : true;

    if (!CryptoAuth.isValidGmail(email)) {
      this.showToast('⚠️ Please enter a valid Gmail address (ending in @gmail.com).');
      return;
    }

    if (!password) {
      this.showToast('⚠️ Password is required.');
      return;
    }

    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing In...';
    }

    try {
      const res = await AuthAPI.login(email, password, rememberMe);

      if (res.needsVerification) {
        this.showVerificationScreen(email, res.verificationCode);
        this.showToast('⚠️ Please verify your Gmail address to activate your account.');
        return;
      }

      this.currentUser = res.user;
      this.renderNavUser();
      this.showToast(`🎉 Welcome back, ${this.currentUser.name}!`);
      this.showMainView();
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In with Gmail →';
      }
    }
  }

  /* Password Recovery & Forgot Password */

  openForgotPasswordModal() {
    const step1 = document.getElementById('forgot-step-1');
    const step2 = document.getElementById('forgot-step-2');
    const emailInput = document.getElementById('forgot-gmail-input');

    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';

    // Autofill email from login input if present
    const loginEmail = document.getElementById('login-gmail-input');
    if (emailInput && loginEmail && loginEmail.value) {
      emailInput.value = loginEmail.value.trim();
    }

    this.openModal('modal-forgot-password');
  }

  async handleForgotPasswordSubmit(event) {
    event.preventDefault();
    const emailInput = document.getElementById('forgot-gmail-input');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';

    if (!CryptoAuth.isValidGmail(email)) {
      this.showToast('⚠️ Please enter a valid Gmail address.');
      return;
    }

    const submitBtn = document.getElementById('btn-forgot-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Recovery Link...';
    }

    try {
      const res = await AuthAPI.forgotPassword(email);
      const step1 = document.getElementById('forgot-step-1');
      const step2 = document.getElementById('forgot-step-2');
      const maskedEmail = document.getElementById('forgot-recovery-masked');
      const tokenInput = document.getElementById('reset-token-input');

      if (step1) step1.style.display = 'none';
      if (step2) step2.style.display = 'block';
      if (maskedEmail) maskedEmail.textContent = res.recoveryEmail;
      if (tokenInput && res.resetToken) tokenInput.value = res.resetToken;

      this.showToast('📨 Reset link sent to your recovery email address!');
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Password Reset Link →';
      }
    }
  }

  handleResetPasswordStrength() {
    const pwdInput = document.getElementById('reset-new-password');
    const fill = document.getElementById('reset-pwd-strength-fill');
    if (!pwdInput || !fill) return;

    const strength = CryptoAuth.evaluatePasswordStrength(pwdInput.value);
    fill.style.width = `${strength.percent}%`;
    fill.className = `strength-bar-fill ${strength.class}`;
    this.validateResetPasswordMatch();
  }

  validateResetPasswordMatch() {
    const pwd = document.getElementById('reset-new-password');
    const confirm = document.getElementById('reset-confirm-password');
    const feedback = document.getElementById('reset-confirm-feedback');
    if (!pwd || !confirm || !feedback) return;

    if (!confirm.value) {
      feedback.textContent = '';
      return;
    }

    if (pwd.value === confirm.value) {
      feedback.className = 'form-feedback valid';
      feedback.textContent = '✅ Passwords match';
    } else {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Passwords do not match';
    }
  }

  async handleResetPasswordSubmit(event) {
    event.preventDefault();
    const token = document.getElementById('reset-token-input').value.trim();
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;

    if (!token) {
      this.showToast('⚠️ Reset token is required.');
      return;
    }

    if (newPassword.length < 8) {
      this.showToast('⚠️ New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showToast('⚠️ Passwords do not match.');
      return;
    }

    try {
      await AuthAPI.resetPassword(token, newPassword, confirmPassword);
      this.closeModal('modal-forgot-password');
      this.showToast('✅ Password updated successfully! Please sign in with your new password.');
      this.switchAuthTab('login');
      const loginPwd = document.getElementById('login-password-input');
      if (loginPwd) loginPwd.value = '';
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  /* User Profile Modal Management */

  openUserProfileModal() {
    if (!this.currentUser) {
      this.showToast('Please sign in to view your profile.');
      this.showLoginView();
      return;
    }

    this.profileModalAvatarData = this.currentUser.avatar || '';

    // Populate elements
    const avatarImg = document.getElementById('profile-modal-avatar-img');
    const removeBtn = document.getElementById('profile-modal-avatar-remove-btn');
    if (avatarImg) avatarImg.src = this.currentUser.avatar || DEFAULT_AVATAR_SVG;
    if (removeBtn) removeBtn.style.display = this.currentUser.avatar ? 'inline-block' : 'none';

    const nameDisplay = document.getElementById('profile-modal-name-display');
    const gmailDisplay = document.getElementById('profile-modal-gmail-display');
    const memberSince = document.getElementById('profile-modal-member-since');

    if (nameDisplay) nameDisplay.textContent = this.currentUser.name;
    if (gmailDisplay) gmailDisplay.textContent = this.currentUser.email;
    if (memberSince) {
      const created = this.currentUser.createdAt ? new Date(this.currentUser.createdAt) : new Date();
      memberSince.textContent = `Member since: ${created.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', day: 'numeric' })}`;
    }

    // Form inputs
    const editName = document.getElementById('profile-edit-name');
    const editGmail = document.getElementById('profile-edit-gmail');
    const editRecovery = document.getElementById('profile-edit-recovery');
    const editOcc = document.getElementById('profile-edit-occupation');
    const editAge = document.getElementById('profile-edit-age');
    const editGender = document.getElementById('profile-edit-gender');
    const editBudget = document.getElementById('profile-edit-budget');
    const editSmoking = document.getElementById('profile-edit-smoking');
    const editDrinking = document.getElementById('profile-edit-drinking');
    const editShift = document.getElementById('profile-edit-shift');
    const editBio = document.getElementById('profile-edit-bio');

    if (editName) editName.value = this.currentUser.name || '';
    if (editGmail) editGmail.value = this.currentUser.email || '';
    if (editRecovery) editRecovery.value = this.currentUser.recoveryEmail || '';
    if (editOcc) editOcc.value = this.currentUser.occupation || '';
    if (editAge) editAge.value = this.currentUser.age || 25;
    if (editGender) editGender.value = this.currentUser.gender || 'Male';
    if (editBudget) editBudget.value = this.currentUser.budget || 7000;
    if (editSmoking) editSmoking.value = this.currentUser.smoking || 'no';
    if (editDrinking) editDrinking.value = this.currentUser.drinking || 'social';
    if (editShift) editShift.value = this.currentUser.workingShift || 'day';
    if (editBio) editBio.value = this.currentUser.bio || '';

    this.switchProfileTab('info');
    this.openModal('modal-user-profile');
  }

  switchProfileTab(tab) {
    const tabInfo = document.getElementById('tab-btn-profile-info');
    const tabSec = document.getElementById('tab-btn-profile-security');
    const formInfo = document.getElementById('form-profile-info');
    const formSec = document.getElementById('form-profile-security');

    if (tabInfo) tabInfo.classList.toggle('active', tab === 'info');
    if (tabSec) tabSec.classList.toggle('active', tab === 'security');

    if (formInfo) formInfo.style.display = tab === 'info' ? 'block' : 'none';
    if (formSec) formSec.style.display = tab === 'security' ? 'block' : 'none';
  }

  async handleUpdateProfileSubmit(event) {
    event.preventDefault();
    if (!this.currentUser) return;

    const name = document.getElementById('profile-edit-name').value.trim();
    const recoveryEmail = document.getElementById('profile-edit-recovery').value.trim().toLowerCase();
    const occupation = document.getElementById('profile-edit-occupation').value.trim();
    const age = parseInt(document.getElementById('profile-edit-age').value) || 25;
    const gender = document.getElementById('profile-edit-gender').value;
    const budget = parseFloat(document.getElementById('profile-edit-budget').value) || 7000;
    const smoking = document.getElementById('profile-edit-smoking').value;
    const drinking = document.getElementById('profile-edit-drinking').value;
    const workingShift = document.getElementById('profile-edit-shift').value;
    const bio = document.getElementById('profile-edit-bio').value.trim();

    if (!name) {
      this.showToast('⚠️ Full Name is required.');
      return;
    }

    if (!CryptoAuth.isValidEmail(recoveryEmail)) {
      this.showToast('⚠️ Please enter a valid recovery email.');
      return;
    }

    if (recoveryEmail === this.currentUser.email.toLowerCase()) {
      this.showToast('⚠️ Recovery email cannot be the same as your Gmail address.');
      return;
    }

    const profileData = {
      name,
      recoveryEmail,
      avatar: this.profileModalAvatarData,
      occupation,
      age,
      gender,
      budget,
      smoking,
      drinking,
      workingShift,
      bio
    };

    try {
      const res = await AuthAPI.updateProfile(this.currentUser.id, profileData);
      this.currentUser = res.user;
      this.renderNavUser();
      this.closeModal('modal-user-profile');
      this.showToast('✅ Profile updated successfully!');
      this.renderListings();
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  handleProfileNewPasswordStrength() {
    const pwdInput = document.getElementById('profile-new-password');
    const fill = document.getElementById('profile-pwd-strength-fill');
    if (!pwdInput || !fill) return;

    const strength = CryptoAuth.evaluatePasswordStrength(pwdInput.value);
    fill.style.width = `${strength.percent}%`;
    fill.className = `strength-bar-fill ${strength.class}`;
    this.validateProfilePasswordMatch();
  }

  validateProfilePasswordMatch() {
    const pwd = document.getElementById('profile-new-password');
    const confirm = document.getElementById('profile-confirm-new-password');
    const feedback = document.getElementById('profile-confirm-feedback');
    if (!pwd || !confirm || !feedback) return;

    if (!confirm.value) {
      feedback.textContent = '';
      return;
    }

    if (pwd.value === confirm.value) {
      feedback.className = 'form-feedback valid';
      feedback.textContent = '✅ Passwords match';
    } else {
      feedback.className = 'form-feedback invalid';
      feedback.textContent = '❌ Passwords do not match';
    }
  }

  async handleChangePasswordSubmit(event) {
    event.preventDefault();
    if (!this.currentUser) return;

    const cur = document.getElementById('profile-current-password').value;
    const newPwd = document.getElementById('profile-new-password').value;
    const confirmPwd = document.getElementById('profile-confirm-new-password').value;

    if (!cur) {
      this.showToast('⚠️ Current password is required.');
      return;
    }

    if (newPwd.length < 8) {
      this.showToast('⚠️ New password must be at least 8 characters long.');
      return;
    }

    if (newPwd !== confirmPwd) {
      this.showToast('⚠️ New passwords do not match.');
      return;
    }

    try {
      await AuthAPI.changePassword(this.currentUser.id, cur, newPwd, confirmPwd);
      document.getElementById('profile-current-password').value = '';
      document.getElementById('profile-new-password').value = '';
      document.getElementById('profile-confirm-new-password').value = '';
      this.closeModal('modal-user-profile');
      this.showToast('🔒 Password changed successfully!');
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  handleSaveOnboardingDetails(event) {
    event.preventDefault();

    if (!this.currentUser) {
      this.showToast('Please sign in first.');
      this.showLoginView();
      return;
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
    this.showToast('✅ Lifestyle & character rules saved! Welcome to NestMate.');
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
      const avatarSrc = this.currentUser.avatar || DEFAULT_AVATAR_SVG;
      const firstName = (this.currentUser.name || 'User').split(' ')[0];

      container.innerHTML = `
        <div style="position: relative;">
          <button class="user-menu-btn" id="user-menu-trigger" onclick="app.toggleUserMenu()">
            <img src="${avatarSrc}" class="user-avatar-circle-sm" alt="Avatar" onerror="this.src=DEFAULT_AVATAR_SVG">
            <div style="text-align: left; line-height: 1.2;">
              <span style="font-size: 0.82rem; font-weight: 700; display: block; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${firstName}
              </span>
              <span style="font-size: 0.68rem; color: var(--success); font-weight: 600;">● Active</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          <div id="user-dropdown-menu" style="display: none; position: absolute; right: 0; top: 48px; width: 250px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-xl); z-index: 60; padding: 8px 0;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color); display:flex; align-items:center; gap:12px;">
              <img src="${avatarSrc}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--primary); flex-shrink:0;" alt="Avatar" onerror="this.src=DEFAULT_AVATAR_SVG">
              <div style="overflow:hidden;">
                <div style="font-weight: 700; font-size: 0.9rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${this.currentUser.name}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${this.currentUser.email}</div>
                <div style="font-size: 0.68rem; color: var(--success); font-weight:700; margin-top:2px;">✅ Verified Gmail</div>
              </div>
            </div>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px;" onclick="app.openUserProfileModal()">
              👤 My Profile & Account Settings
            </button>
            <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-radius: 0; padding: 10px 16px;" onclick="app.showOnboardingView()">
              ⚖️ Edit Lifestyle & Character Rules
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
          Sign In / Register
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
     Real Photo Uploading (Drag, Drop, Preview & Scroll)
     ========================================================================== */

  setupDragAndDrop() {
    const dropzone = document.querySelector('.photo-upload-zone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = '#047857';
        dropzone.style.backgroundColor = 'rgba(5, 150, 105, 0.12)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.style.borderColor = '#059669';
        dropzone.style.backgroundColor = 'rgba(5, 150, 105, 0.04)';
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      this.processFiles(files);
    }, false);
  }

  async loadListingsFromBackend() {
    const container = document.getElementById('listings-container');
    if (container && (!this.listings || this.listings.length === 0)) {
      this.renderListingsSkeleton();
    }
    try {
      const serverListings = await ListingsAPI.fetchListings('all');
      if (Array.isArray(serverListings)) {
        this.listings = serverListings;
        Storage.saveListings(this.listings);
      }
    } catch (err) {
      console.warn('Backend listings sync error:', err);
      this.listings = Storage.getListings();
    } finally {
      this.renderListings();
    }
  }

  renderListingsSkeleton() {
    const container = document.getElementById('listings-container');
    if (!container) return;
    container.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-media"></div>
        <div class="skeleton-body">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    `).join('');
  }

  handleFileUpload(event) {
    const files = event.target.files;
    this.processFiles(files);
    event.target.value = '';
  }

  processFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      this.showToast('Please select valid image files (JPG, PNG, WEBP)');
      return;
    }

    const maxAllowed = 15;
    const remainingSlots = maxAllowed - this.newListingPhotos.length;
    if (remainingSlots <= 0) {
      this.showToast(`⚠️ You have already uploaded the maximum limit of ${maxAllowed} photos.`);
      return;
    }

    const filesToLoad = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      this.showToast(`📸 Notice: Adding only ${remainingSlots} photo(s) to stay within the 15-photo limit.`);
    }

    let loadedCount = 0;
    filesToLoad.forEach(file => {
      if (file.size > 8 * 1024 * 1024) {
        this.showToast(`⚠️ "${file.name}" exceeds 8MB and was skipped.`);
        loadedCount++;
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        this.newListingPhotos.push(e.target.result);
        loadedCount++;
        if (loadedCount === filesToLoad.length) {
          this.renderPostPhotoPreviews();
          this.showToast(`📸 ${this.newListingPhotos.length} / ${maxAllowed} photo(s) uploaded! You can pick your cover image.`);
          
          setTimeout(() => {
            const previewEl = document.getElementById('post-photo-previews');
            if (previewEl) {
              previewEl.scrollLeft = previewEl.scrollWidth;
            }
          }, 100);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  setCoverPhoto(index) {
    if (index >= 0 && index < this.newListingPhotos.length) {
      this.coverPhotoIndex = index;
      this.renderPostPhotoPreviews();
      this.showToast(`★ Photo #${index + 1} selected as the main cover photo!`);
    }
  }

  removePostPhoto(index) {
    this.newListingPhotos.splice(index, 1);
    if (this.coverPhotoIndex === index) {
      this.coverPhotoIndex = 0;
    } else if (this.coverPhotoIndex > index) {
      this.coverPhotoIndex--;
    }
    this.renderPostPhotoPreviews();
    this.showToast('Photo removed');
  }

  renderPostPhotoPreviews() {
    const container = document.getElementById('post-photo-previews');
    const countBadge = document.getElementById('post-photo-count');
    if (countBadge) {
      countBadge.textContent = this.newListingPhotos.length;
    }

    if (!container) return;

    if (this.newListingPhotos.length === 0) {
      this.coverPhotoIndex = 0;
      container.innerHTML = `
        <div style="flex: 1; padding: 14px; text-align: center; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          No photos uploaded yet. Click above or drag & drop real photos here (Up to 15 photos).
        </div>
      `;
      return;
    }

    if (this.coverPhotoIndex >= this.newListingPhotos.length) {
      this.coverPhotoIndex = 0;
    }

    container.innerHTML = this.newListingPhotos.map((img, idx) => {
      const isCover = idx === this.coverPhotoIndex;
      return `
        <div class="photo-thumb ${isCover ? 'is-cover' : ''}" title="Photo ${idx + 1}">
          <img src="${img}" alt="Room Photo ${idx + 1}">
          ${isCover ? `
            <span class="photo-thumb-cover-badge">★ Cover Photo</span>
          ` : `
            <span class="photo-thumb-badge">#${idx + 1}</span>
            <button type="button" class="photo-thumb-set-cover-btn" onclick="app.setCoverPhoto(${idx})" title="Set as main cover picture">★ Set Cover</button>
          `}
          <button type="button" class="photo-thumb-remove" onclick="app.removePostPhoto(${idx})" title="Delete photo">&times;</button>
        </div>
      `;
    }).join('');
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
     Photo & Listing Sharing Features
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
    const photoCount = listing.images ? listing.images.length : 0;
    const msg = `🏡 *Room / Roommate Available in ${listing.location}!*\n` +
      `📍 *Address:* ${listing.address}\n` +
      `💰 *Rent Split:* ₹${listing.rentSplit.toLocaleString('en-IN')}/month\n` +
      `👥 *Roommates Needed:* ${listing.roommatesNeeded}\n` +
      `📸 *Photos Attached:* ${photoCount} high-res photos available\n` +
      `🚭 *Habits:* ${listing.smokingRule === 'no' ? 'Non-Smoker' : 'Balcony smoking ok'} | ${listing.drinkingRule === 'no' ? 'Non-Drinker' : 'Social ok'}\n` +
      `📞 *Contact:* ${listing.host ? listing.host.phone : 'Check listing'}\n\n` +
      `👉 *View Full Photo Gallery & Google Map:* ${shareUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  }

  downloadCurrentPhoto() {
    if (!this.detailActiveListing || !this.detailActiveListing.images) return;
    const imgData = this.detailActiveListing.images[this.detailActivePhotoIdx];
    if (!imgData) return;

    const a = document.createElement('a');
    a.href = imgData;
    a.download = `nestmate-room-${this.detailActiveListing.id}-photo-${this.detailActivePhotoIdx + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('📥 Photo downloaded to your device!');
  }

  copyListingShareText(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;

    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${listing.id}`;
    const text = `🏡 Room Available in ${listing.location} (Kerala)\nRent: ₹${listing.rentSplit.toLocaleString('en-IN')}/month | Roommates needed: ${listing.roommatesNeeded}\nAddress: ${listing.address}\nView full photo gallery & Google Map: ${shareUrl}`;
    this.copyToClipboard(text, '📋 Room details & gallery link copied! Ready to paste in WhatsApp.');
  }

  /* Card level photo flip with Carousel Dots */
  nextCardPhoto(listingId, event) {
    if (event) event.stopPropagation();
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    const images = (listing.images && listing.images.length > 0) ? listing.images : (listing.coverImage ? [listing.coverImage] : [KERALA_ROOM_SVG]);
    if (images.length <= 1) return;

    const currentIdx = this.cardPhotoIndices[listingId] || 0;
    const nextIdx = (currentIdx + 1) % images.length;
    this.cardPhotoIndices[listingId] = nextIdx;

    const cardImg = document.getElementById(`card-img-${listingId}`);
    const badge = document.getElementById(`card-photo-counter-${listingId}`);
    const dotsContainer = document.getElementById(`card-dots-${listingId}`);

    if (cardImg) cardImg.src = images[nextIdx];
    if (badge) badge.textContent = `📷 ${nextIdx + 1}/${images.length}`;
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.card-dot').forEach((dot, dIdx) => {
        dot.classList.toggle('active', dIdx === (nextIdx % 5));
      });
    }
  }

  prevCardPhoto(listingId, event) {
    if (event) event.stopPropagation();
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    const images = (listing.images && listing.images.length > 0) ? listing.images : (listing.coverImage ? [listing.coverImage] : [KERALA_ROOM_SVG]);
    if (images.length <= 1) return;

    const currentIdx = this.cardPhotoIndices[listingId] || 0;
    const prevIdx = (currentIdx - 1 + images.length) % images.length;
    this.cardPhotoIndices[listingId] = prevIdx;

    const cardImg = document.getElementById(`card-img-${listingId}`);
    const badge = document.getElementById(`card-photo-counter-${listingId}`);
    const dotsContainer = document.getElementById(`card-dots-${listingId}`);

    if (cardImg) cardImg.src = images[prevIdx];
    if (badge) badge.textContent = `📷 ${prevIdx + 1}/${images.length}`;
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.card-dot').forEach((dot, dIdx) => {
        dot.classList.toggle('active', dIdx === (prevIdx % 5));
      });
    }
  }

  /* Detail Modal Photo Switching */
  setDetailActivePhoto(idx) {
    if (!this.detailActiveListing) return;
    const images = (this.detailActiveListing.images && this.detailActiveListing.images.length > 0) 
      ? this.detailActiveListing.images 
      : (this.detailActiveListing.coverImage ? [this.detailActiveListing.coverImage] : [KERALA_ROOM_SVG]);
    const total = images.length;
    if (total === 0) return;

    this.detailActivePhotoIdx = (idx + total) % total;
    const imgEl = document.getElementById('main-carousel-img');
    const badgeEl = document.getElementById('carousel-counter-badge');

    if (imgEl) {
      imgEl.style.opacity = '0.3';
      setTimeout(() => {
        imgEl.src = images[this.detailActivePhotoIdx];
        imgEl.style.opacity = '1';
      }, 120);
    }

    if (badgeEl) {
      badgeEl.textContent = `📷 Photo ${this.detailActivePhotoIdx + 1} of ${total}`;
    }

    // Update active thumb outline
    document.querySelectorAll('.detail-thumb-item').forEach((el, i) => {
      el.classList.toggle('active', i === this.detailActivePhotoIdx);
    });
  }

  /* Fullscreen Lightbox Photo Viewer */
  openLightbox(photos, startIndex = 0) {
    if (!photos || photos.length === 0) return;
    this.lightboxPhotos = photos;
    this.lightboxActiveIdx = (startIndex >= 0 && startIndex < photos.length) ? startIndex : 0;
    this.renderLightbox();
    const modal = document.getElementById('modal-image-lightbox');
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeLightbox() {
    const modal = document.getElementById('modal-image-lightbox');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  prevLightboxPhoto() {
    if (!this.lightboxPhotos || this.lightboxPhotos.length <= 1) return;
    this.lightboxActiveIdx = (this.lightboxActiveIdx - 1 + this.lightboxPhotos.length) % this.lightboxPhotos.length;
    this.renderLightbox();
  }

  nextLightboxPhoto() {
    if (!this.lightboxPhotos || this.lightboxPhotos.length <= 1) return;
    this.lightboxActiveIdx = (this.lightboxActiveIdx + 1) % this.lightboxPhotos.length;
    this.renderLightbox();
  }

  renderLightbox() {
    const img = document.getElementById('lightbox-active-img');
    const counter = document.getElementById('lightbox-counter');
    const filmstrip = document.getElementById('lightbox-filmstrip');

    if (img && this.lightboxPhotos[this.lightboxActiveIdx]) {
      img.src = this.lightboxPhotos[this.lightboxActiveIdx];
    }
    if (counter) {
      counter.textContent = `Photo ${this.lightboxActiveIdx + 1} of ${this.lightboxPhotos.length}`;
    }
    if (filmstrip) {
      filmstrip.innerHTML = this.lightboxPhotos.map((p, idx) => `
        <div class="lightbox-thumb ${idx === this.lightboxActiveIdx ? 'active' : ''}" onclick="app.openLightbox(app.lightboxPhotos, ${idx})">
          <img src="${p}" alt="Photo ${idx + 1}">
        </div>
      `).join('');
    }
  }

  /* ==========================================================================
     Filtering & Search
     ========================================================================== */

  handleSearchInput() {
    const locInput = document.getElementById('search-location');
    this.searchQuery = locInput ? locInput.value.trim().toLowerCase() : '';
    const quickInput = document.getElementById('quick-search-location');
    if (quickInput && locInput) quickInput.value = locInput.value;

    this.searchRoommates = document.getElementById('search-roommates').value;
    const budgetVal = document.getElementById('search-budget').value;
    this.searchBudget = budgetVal ? parseFloat(budgetVal) : null;
    this.renderListings();
  }

  handleQuickLocationInput(value) {
    this.searchQuery = (value || '').trim().toLowerCase();
    const heroInput = document.getElementById('search-location');
    if (heroInput) heroInput.value = value;
    this.renderListings();
  }

  clearLocationSearch() {
    this.searchQuery = '';
    const heroInput = document.getElementById('search-location');
    if (heroInput) heroInput.value = '';
    const quickInput = document.getElementById('quick-search-location');
    if (quickInput) quickInput.value = '';
    this.renderListings();
    this.showToast('📍 Location filter cleared');
  }

  clearRoommatesFilter() {
    this.searchRoommates = 'all';
    const sel = document.getElementById('search-roommates');
    if (sel) sel.value = 'all';
    this.renderListings();
  }

  clearBudgetFilter() {
    this.searchBudget = null;
    const bud = document.getElementById('search-budget');
    if (bud) bud.value = '';
    this.renderListings();
  }

  renderActiveFilterChips() {
    const container = document.getElementById('active-filters-container');
    if (!container) return;

    let chips = [];
    if (this.searchQuery) {
      chips.push(`
        <span class="filter-chip" onclick="app.clearLocationSearch()" title="Click to clear location filter">
          📍 Location: <strong>${this.searchQuery}</strong> &times;
        </span>
      `);
    }
    if (this.searchRoommates && this.searchRoommates !== 'all') {
      chips.push(`
        <span class="filter-chip" onclick="app.clearRoommatesFilter()" title="Click to clear">
          👥 ${this.searchRoommates} Roommate(s) &times;
        </span>
      `);
    }
    if (this.searchBudget) {
      chips.push(`
        <span class="filter-chip" onclick="app.clearBudgetFilter()" title="Click to clear">
          💰 Max ₹${this.searchBudget.toLocaleString('en-IN')} &times;
        </span>
      `);
    }

    container.innerHTML = chips.join('');
  }

  matchLocationQuery(item, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    if (!q) return true;

    // Searchable text combining all location-related fields
    const text = [
      item.location || '',
      item.neighborhood || '',
      item.address || '',
      item.city || '',
      item.title || '',
      item.description || ''
    ].join(' ').toLowerCase();

    // 1. Direct substring match
    if (text.includes(q)) return true;

    // 2. Kerala hubs & cities aliases
    const aliases = {
      'kochi': ['cochin', 'kakkanad', 'infopark', 'edappally', 'palarivattom', 'kaloor', 'vyttila', 'aluva', 'ernakulam'],
      'cochin': ['kochi', 'ernakulam', 'kakkanad', 'infopark', 'edappally'],
      'ernakulam': ['kochi', 'cochin', 'kakkanad', 'infopark', 'edappally', 'palarivattom', 'kaloor', 'vyttila'],
      'kakkanad': ['infopark', 'kochi', 'ernakulam'],
      'infopark': ['kakkanad', 'kochi', 'ernakulam'],
      'edappally': ['kochi', 'ernakulam'],
      'trivandrum': ['thiruvananthapuram', 'technopark', 'kazhakkoottam', 'karyavattom', 'kowdiar', 'pattom', 'vellayambalam'],
      'thiruvananthapuram': ['trivandrum', 'technopark', 'kazhakkoottam', 'karyavattom'],
      'technopark': ['kazhakkoottam', 'trivandrum', 'thiruvananthapuram'],
      'kazhakkoottam': ['technopark', 'trivandrum', 'thiruvananthapuram'],
      'calicut': ['kozhikode', 'cyberpark', 'palazhi', 'hilite'],
      'kozhikode': ['calicut', 'cyberpark', 'palazhi', 'hilite'],
      'cyberpark': ['kozhikode', 'calicut'],
      'thrissur': ['trichur', 'swaraj round', 'ayyanthole'],
      'trichur': ['thrissur', 'swaraj round'],
      'kottayam': ['kottayam town'],
      'palakkad': ['palghat']
    };

    // Check alias match
    for (const [key, hubList] of Object.entries(aliases)) {
      if (q.includes(key)) {
        if (hubList.some(hub => text.includes(hub))) return true;
      }
    }

    // 3. Multi-word search (e.g. "Infopark Kakkanad")
    const words = q.split(/[\s,]+/).filter(w => w.length > 1);
    if (words.length > 1) {
      if (words.some(w => text.includes(w))) return true;
    }

    return false;
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
    const quickInput = document.getElementById('quick-search-location');
    if (quickInput) quickInput.value = city;

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

    // Sync latest rooms from backend so all rooms uploaded by all users show up
    this.loadListingsFromBackend();
  }

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

    // Tab-based visibility filtering
    if (this.activeTab === 'my-listings') {
      if (!this.currentUser) return [];
      result = result.filter(item => item.hostId === this.currentUser.id && item.status !== 'DELETED');
    } else {
      // Available Properties, Private, Shared: Only show ACTIVE listings
      result = result.filter(item => item.status !== 'INACTIVE' && item.status !== 'RENTED' && item.status !== 'DELETED');

      if (this.activeTab === 'private') {
        result = result.filter(item => (item.roomType || '').toLowerCase().includes('private'));
      } else if (this.activeTab === 'shared') {
        result = result.filter(item => (item.roomType || '').toLowerCase().includes('shared'));
      }
    }

    if (this.searchQuery) {
      result = result.filter(item => this.matchLocationQuery(item, this.searchQuery));
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

    // Sorting
    if (this.sortMode === 'match_desc') {
      result.sort((a, b) => b.matchData.score - a.matchData.score);
    } else if (this.sortMode === 'price_asc') {
      result.sort((a, b) => a.rentSplit - b.rentSplit);
    } else if (this.sortMode === 'price_desc') {
      result.sort((a, b) => b.rentSplit - a.rentSplit);
    } else if (this.sortMode === 'newest') {
      result.sort((a, b) => {
        const timeA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const timeB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return timeB - timeA;
      });
    }

    return result;
  }

  updateTabCounts() {
    const activeListings = this.listings.filter(l => l.status !== 'INACTIVE' && l.status !== 'RENTED' && l.status !== 'DELETED');
    const countAll = document.getElementById('count-all');
    const countPrivate = document.getElementById('count-private');
    const countShared = document.getElementById('count-shared');
    const countMy = document.getElementById('count-my-listings');

    if (countAll) countAll.textContent = activeListings.length;
    if (countPrivate) countPrivate.textContent = activeListings.filter(l => (l.roomType || '').toLowerCase().includes('private')).length;
    if (countShared) countShared.textContent = activeListings.filter(l => (l.roomType || '').toLowerCase().includes('shared')).length;
    if (countMy) {
      if (this.currentUser) {
        countMy.textContent = this.listings.filter(l => l.hostId === this.currentUser.id && l.status !== 'DELETED').length;
      } else {
        countMy.textContent = '0';
      }
    }
  }

  /* Render Listings Grid */
  renderListings() {
    this.updateTabCounts();
    this.renderActiveFilterChips();
    const container = document.getElementById('listings-container');
    if (!container) return;

    const list = this.getProcessedListings();
    
    const countText = document.getElementById('results-count-text');
    if (countText) {
      const tabName = this.activeTab === 'my-listings' ? 'my listings' : (this.activeTab === 'private' ? 'private rooms' : (this.activeTab === 'shared' ? 'shared rooms' : 'available properties'));
      countText.innerHTML = `Showing <span>${list.length} ${list.length === 1 ? 'room' : 'rooms'}</span> in ${tabName}`;
    }

    // Modern Airbnb Empty State
    if (list.length === 0) {
      const isMyListingsTab = this.activeTab === 'my-listings';
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 24px; background: var(--bg-surface); border: 2px dashed var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
          <div style="font-size: 3.5rem; margin-bottom: 12px;">${isMyListingsTab ? '🏠' : '🌴'}</div>
          <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; color: var(--text-main);">
            ${isMyListingsTab ? 'You haven’t published any rooms yet!' : 'No properties found matching your criteria!'}
          </h3>
          <p style="color: var(--text-muted); max-width: 540px; margin: 0 auto 24px; font-size: 0.95rem; line-height: 1.6;">
            ${isMyListingsTab 
              ? 'Click below to publish your room in Kakkanad Infopark, Technopark Trivandrum, Cyberpark Calicut, or anywhere in Kerala. You can upload up to 15 real photos and pick your cover picture!'
              : 'Try clearing your filters or be the first to publish a room in this location.'}
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-lg" onclick="app.openPostRoomModal()">
              ➕ Publish a Room Now
            </button>
            ${!isMyListingsTab ? `
              <button class="btn btn-secondary btn-lg" onclick="app.resetFilters()">
                🔄 Reset Filters
              </button>
            ` : ''}
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
    
    // Order images with coverImage first if specified
    let images = item.images && item.images.length > 0 ? [...item.images] : [];
    if (item.coverImage && images.includes(item.coverImage)) {
      images = [item.coverImage, ...images.filter(x => x !== item.coverImage)];
    } else if (item.coverImage && images.length === 0) {
      images = [item.coverImage];
    }
    if (images.length === 0) images = [KERALA_ROOM_SVG];

    const currentIdx = this.cardPhotoIndices[item.id] || 0;
    const currentImg = images[currentIdx] || images[0];

    const smokeTag = item.smokingRule === 'no' 
      ? '<span class="life-chip match-good">🚭 Non-Smoker</span>' 
      : '<span class="life-chip">💨 Balcony Smoke</span>';

    const drinkTag = item.drinkingRule === 'no'
      ? '<span class="life-chip match-good">🚫 Non-Drinker</span>'
      : '<span class="life-chip">🍷 Social Drinks</span>';

    const shiftTag = item.workingShiftPreference === 'wfh'
      ? '<span class="life-chip">💻 WFH Friendly</span>'
      : '<span class="life-chip">💼 Day Shift</span>';

    const showArrows = images.length > 1;

    // Status Badge
    let statusBadgeHTML = '';
    if (item.status === 'RENTED') {
      statusBadgeHTML = '<span class="card-status-badge status-rented">Occupied / Rented</span>';
    } else if (item.status === 'INACTIVE') {
      statusBadgeHTML = '<span class="card-status-badge status-inactive">Paused / Inactive</span>';
    } else if (this.activeTab === 'my-listings' && (item.status === 'ACTIVE' || !item.status)) {
      statusBadgeHTML = '<span class="card-status-badge status-active">Live & Active</span>';
    }

    // Top 3 facilities pills
    const facilitiesHTML = (item.amenities || []).slice(0, 3).map(am => 
      `<span class="life-chip" style="font-size:0.75rem; background:var(--bg-surface-alt);"><span style="color:var(--primary); font-weight:bold;">✓</span> ${am}</span>`
    ).join('');

    const isOwner = this.currentUser && (item.hostId === this.currentUser.id || item.userId === this.currentUser.id);

    return `
      <div class="listing-card" id="card-${item.id}">
        <div class="card-media">
          <img src="${currentImg}" id="card-img-${item.id}" class="card-img" alt="${item.title}" onerror="this.src='${KERALA_ROOM_SVG}'" onclick="app.openListingDetail('${item.id}')" style="cursor: pointer;">
          
          ${statusBadgeHTML}

          ${showArrows ? `
            <button class="card-nav-prev" onclick="app.prevCardPhoto('${item.id}', event)" title="Previous photo">&lsaquo;</button>
            <button class="card-nav-next" onclick="app.nextCardPhoto('${item.id}', event)" title="Next photo">&rsaquo;</button>
          ` : ''}

          ${images.length > 1 ? `
            <div class="card-dots" id="card-dots-${item.id}">
              ${images.slice(0, 5).map((_, i) => `<span class="card-dot ${i === (currentIdx % 5) ? 'active' : ''}"></span>`).join('')}
            </div>
          ` : ''}

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
            <span class="pill-badge" id="card-photo-counter-${item.id}">📷 ${currentIdx + 1}/${images.length} Photos</span>
            <span class="pill-badge">🚪 ${item.roomType || 'Room'}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-price-row">
            <div class="card-price">
              ₹${item.rentSplit.toLocaleString('en-IN')} <small>/ month</small>
            </div>
            <div class="roommates-needed-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              ${item.roommatesNeeded} space${item.roommatesNeeded > 1 ? 's' : ''} available
            </div>
          </div>

          <h3 class="card-title" title="${item.title}" onclick="app.openListingDetail('${item.id}')" style="cursor: pointer;">${item.title}</h3>

          <div class="card-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${item.location}
          </div>

          <div class="lifestyle-chips">
            ${smokeTag}
            ${drinkTag}
            ${shiftTag}
          </div>

          ${facilitiesHTML ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
              ${facilitiesHTML}
            </div>
          ` : ''}

          <div class="card-footer">
            <div class="host-mini" title="Host: ${host ? host.name : 'Host'}">
              ${(host && host.avatar) || (item && item.hostAvatar) ? `
                <img src="${(host && host.avatar) || item.hostAvatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1.5px solid var(--primary); flex-shrink:0;" alt="Host Avatar" onerror="this.src=DEFAULT_AVATAR_SVG">
              ` : `
                <div class="host-avatar" style="display:flex; align-items:center; justify-content:center; background:#059669; color:#fff; font-weight:700; width:32px; height:32px; border-radius:50%;">
                  ${(host && host.name ? host.name : 'H').charAt(0).toUpperCase()}
                </div>
              `}
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
                View Details
              </button>
              <button class="btn btn-whatsapp btn-sm" onclick="app.shareListingOnWhatsApp('${item.id}')" title="Share Photos to WhatsApp">
                Share
              </button>
            </div>
          </div>

          ${isOwner ? `
            <div class="card-owner-toolbar">
              <div style="font-size: 0.74rem; font-weight: 800; color: var(--text-muted); margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span>🔑 Manage My Listing</span>
                <span style="font-weight: 800; color: ${item.status === 'RENTED' ? '#dc2626' : (item.status === 'INACTIVE' ? '#64748b' : '#059669')};">
                  ● ${item.status === 'RENTED' ? 'Occupied / Rented' : (item.status === 'INACTIVE' ? 'Paused' : 'Live & Active')}
                </span>
              </div>
              <div class="owner-actions-row">
                ${item.status === 'RENTED' ? `
                  <button type="button" class="btn btn-sm btn-outline" onclick="app.toggleListingStatus('${item.id}', 'ACTIVE')" title="Make listing available again">
                    🔄 Reactivate Room
                  </button>
                ` : `
                  <button type="button" class="btn btn-sm btn-outline" style="border-color: #f59e0b; color: #b45309; font-weight: 700;" onclick="app.toggleListingStatus('${item.id}', 'RENTED')" title="Found roommates! Mark room as rented">
                    🤝 Found Roommates
                  </button>
                `}
                <button type="button" class="btn btn-sm btn-primary" onclick="app.editListing('${item.id}')" title="Edit room details and photos">
                  ✏️ Edit
                </button>
                <button type="button" class="btn btn-sm btn-secondary" style="color: #dc2626; border-color: rgba(220, 38, 38, 0.4); font-weight: 700;" onclick="app.deleteListing('${item.id}')" title="Delete listing permanently">
                  🗑️ Delete Post
                </button>
              </div>
            </div>
          ` : ''}

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
     Listing Details Modal (With Interactive Photo Carousel & Sharing Toolbar)
     ========================================================================== */

  openListingDetail(id) {
    const listing = this.listings.find(l => l.id === id);
    if (!listing) return;

    this.detailActiveListing = listing;
    this.detailActivePhotoIdx = 0;

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
    const totalPhotos = images.length;

    // Build thumbnails strip
    const thumbsHTML = images.map((img, i) => `
      <div class="detail-thumb-item ${i === 0 ? 'active' : ''}" onclick="app.setDetailActivePhoto(${i})">
        <img src="${img}" alt="Thumbnail ${i + 1}">
      </div>
    `).join('');

    const amenitiesHTML = (listing.amenities || []).map(am => `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; padding: 8px 12px; background: var(--bg-surface-alt); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <span style="color: var(--primary); font-weight: bold;">✔</span> ${am}
      </div>
    `).join('');

    const gmapQuery = encodeURIComponent(`${listing.address || ''}, ${listing.location || ''}, Kerala, India`);
    const gmapEmbedUrl = `https://maps.google.com/maps?q=${gmapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    const gmapExternalUrl = `https://www.google.com/maps/search/?api=1&query=${gmapQuery}`;
    const gmapDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${gmapQuery}`;

    const isOwner = this.currentUser && (listing.hostId === this.currentUser.id || listing.userId === this.currentUser.id);

    bodyEl.innerHTML = `
      ${isOwner ? `
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 95, 70, 0.08)); border: 1.5px solid var(--primary); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
              <span>🔑 Host Controls: Your Published Room</span>
              <span class="pill-badge" style="background: ${listing.status === 'RENTED' ? '#fee2e2' : '#d1fae5'}; color: ${listing.status === 'RENTED' ? '#dc2626' : '#059669'}; font-size: 0.72rem; padding: 3px 8px;">● ${listing.status === 'RENTED' ? 'Occupied / Rented' : (listing.status === 'INACTIVE' ? 'Paused' : 'Live & Active')}</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
              Found your roommates? You can mark this room as rented or permanently delete this post anytime.
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${listing.status !== 'RENTED' ? `
              <button type="button" class="btn btn-sm btn-outline" style="border-color: #f59e0b; color: #b45309; font-weight: 700;" onclick="app.toggleListingStatus('${listing.id}', 'RENTED'); app.closeModal('modal-listing-detail');">
                🤝 Found Roommates! (Mark Rented)
              </button>
            ` : `
              <button type="button" class="btn btn-sm btn-outline" onclick="app.toggleListingStatus('${listing.id}', 'ACTIVE'); app.closeModal('modal-listing-detail');">
                🔄 Re-open Listing
              </button>
            `}
            <button type="button" class="btn btn-sm btn-secondary" onclick="app.editListing('${listing.id}'); app.closeModal('modal-listing-detail');">
              ✏️ Edit Details
            </button>
            <button type="button" class="btn btn-sm btn-danger" style="background: #dc2626; color: #fff; border: none; font-weight: 700; padding: 6px 14px;" onclick="app.deleteListing('${listing.id}', true)">
              🗑️ Delete Post Permanently
            </button>
          </div>
        </div>
      ` : ''}

      <!-- INTERACTIVE PHOTO CAROUSEL -->
      <div class="detail-photo-carousel">
        <img src="${images[0]}" id="main-carousel-img" alt="Room Photo" onclick="app.openLightbox(app.detailActiveListing.images || [app.detailActiveListing.coverImage], app.detailActivePhotoIdx)" style="cursor: zoom-in;" title="Click to open fullscreen photo viewer">

        ${totalPhotos > 1 ? `
          <button class="carousel-btn carousel-prev" onclick="app.setDetailActivePhoto(app.detailActivePhotoIdx - 1)" title="Previous photo">&lsaquo;</button>
          <button class="carousel-btn carousel-next" onclick="app.setDetailActivePhoto(app.detailActivePhotoIdx + 1)" title="Next photo">&rsaquo;</button>
        ` : ''}

        <div style="position: absolute; bottom: 14px; left: 16px; z-index: 10;">
          <span class="pill-badge" id="carousel-counter-badge" style="font-size: 0.82rem; padding: 6px 12px; cursor: pointer;" onclick="app.openLightbox(app.detailActiveListing.images || [app.detailActiveListing.coverImage], app.detailActivePhotoIdx)">
            📷 Photo 1 of ${totalPhotos} (Click to Expand ⤢)
          </span>
        </div>
      </div>

      <!-- Thumbnails Strip (Scrollable) -->
      ${totalPhotos > 1 ? `
        <div class="detail-thumbs-strip">
          ${thumbsHTML}
        </div>
      ` : ''}

      <!-- PHOTO SHARING & ACTION TOOLBAR -->
      <div class="photo-share-toolbar">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
          <span>📸 Photos & Actions</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${totalPhotos} uploaded)</span>
        </div>
        <div class="photo-share-actions">
          <button class="btn btn-primary btn-sm" onclick="app.openLightbox(app.detailActiveListing.images || [app.detailActiveListing.coverImage], app.detailActivePhotoIdx)" title="Browse all room photos in fullscreen">
            ⤢ Fullscreen Gallery
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="app.shareListingOnWhatsApp('${listing.id}')" title="Share with photos on WhatsApp">
            📲 Share on WhatsApp
          </button>
          <button class="btn btn-secondary btn-sm" onclick="app.downloadCurrentPhoto()" title="Save current photo to your device">
            📥 Save Photo
          </button>
          <button class="btn btn-outline btn-sm" onclick="app.copyListingShareText('${listing.id}')" title="Copy photo link">
            📋 Copy Link
          </button>
        </div>
      </div>

      <!-- Quick Summary -->
      <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">
            ₹${listing.rentSplit.toLocaleString('en-IN')} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">/ month per person</span>
          </div>
          <div style="font-size: 0.88rem; color: var(--text-muted);">
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

      <!-- Host Profile & Direct Contact Box -->
      <div class="host-profile-box">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${(host && host.avatar) || (listing && listing.hostAvatar) ? `
              <img src="${(host && host.avatar) || listing.hostAvatar}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary); flex-shrink: 0;" alt="Host Avatar" onerror="this.src=DEFAULT_AVATAR_SVG">
            ` : `
              <div style="width: 52px; height: 52px; border-radius: 50%; background: #059669; color: #fff; font-size: 1.2rem; font-weight: bold; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${(host.name || 'H').charAt(0).toUpperCase()}
              </div>
            `}
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
     Post a Room Listing & Airbnb-Style Property Management
     ========================================================================== */

  openPostRoomModal(editListingId = null) {
    if (!this.currentUser) {
      this.showToast('Please sign in or register to publish your room!');
      this.showLoginView();
      return;
    }

    const modalTitle = document.getElementById('post-room-modal-title');
    const submitBtn = document.getElementById('post-room-submit-btn');
    const editingInput = document.getElementById('post-editing-id');

    if (editListingId) {
      const listing = this.listings.find(l => l.id === editListingId);
      if (!listing) return;
      this.editingListingId = editListingId;
      if (editingInput) editingInput.value = editListingId;
      if (modalTitle) modalTitle.innerHTML = '✏️ Edit Room Listing';
      if (submitBtn) submitBtn.textContent = 'Save Changes';

      document.getElementById('post-title').value = listing.title || '';
      document.getElementById('post-room-type').value = listing.roomType || 'Private Room';
      document.getElementById('post-location').value = listing.location || '';
      document.getElementById('post-address').value = listing.address || '';
      document.getElementById('post-rent-split').value = listing.rentSplit || '';
      document.getElementById('post-roommates-needed').value = listing.roommatesNeeded || 1;
      document.getElementById('post-deposit').value = listing.deposit || '';
      document.getElementById('post-available-date').value = listing.availableFrom || 'Immediate';
      document.getElementById('post-smoking-rule').value = listing.smokingRule || 'no';
      document.getElementById('post-drinking-rule').value = listing.drinkingRule || 'social';
      document.getElementById('post-shift-preference').value = listing.workingShiftPreference || 'any';
      document.getElementById('post-gender-preference').value = listing.genderPreference || 'any';
      document.getElementById('post-description').value = listing.description || '';

      // Check amenities checkboxes
      const amenitiesList = listing.amenities || [];
      document.querySelectorAll('.amenity-checkbox input').forEach(cb => {
        cb.checked = amenitiesList.includes(cb.value);
      });

      // Load existing images and cover photo
      this.newListingPhotos = listing.images ? [...listing.images] : (listing.coverImage ? [listing.coverImage] : []);
      this.coverPhotoIndex = 0;
      if (listing.coverImage && this.newListingPhotos.length > 0) {
        const foundIdx = this.newListingPhotos.indexOf(listing.coverImage);
        if (foundIdx > -1) this.coverPhotoIndex = foundIdx;
      }
      this.renderPostPhotoPreviews();
      this.updateFormMapPreview();
    } else {
      this.editingListingId = null;
      if (editingInput) editingInput.value = '';
      if (modalTitle) modalTitle.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Post a Room & Find Roommates in Kerala
      `;
      if (submitBtn) submitBtn.textContent = 'Publish Room Listing';

      const form = document.getElementById('form-post-room');
      if (form) form.reset();
      this.newListingPhotos = [];
      this.coverPhotoIndex = 0;
      this.renderPostPhotoPreviews();
      this.updateFormMapPreview();
    }

    this.openModal('modal-post-room');
  }

  editListing(id) {
    this.openPostRoomModal(id);
  }

  async toggleListingStatus(id, newStatus) {
    try {
      await ListingsAPI.updateStatus(id, newStatus);
      const listing = this.listings.find(l => l.id === id);
      if (listing) {
        listing.status = newStatus;
      }
      Storage.saveListings(this.listings);
      this.renderListings();
      this.showToast(`Listing is now marked as ${newStatus}!`);
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  async deleteListing(id, fromModal = false) {
    if (!confirm('Are you sure you want to permanently delete this room post? Once deleted, it will be completely removed from the website.')) return;
    try {
      await ListingsAPI.deleteListing(id, this.currentUser ? this.currentUser.id : null);
      this.listings = this.listings.filter(l => l.id !== id);
      Storage.saveListings(this.listings);
      if (fromModal) {
        this.closeModal('modal-listing-detail');
      }
      this.renderListings();
      this.showToast('🗑️ Your room post has been deleted successfully.');
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    }
  }

  async handleCreateListing(event) {
    event.preventDefault();

    if (!this.currentUser) {
      this.showToast('Please sign in or register to publish your room!');
      this.showLoginView();
      return;
    }

    // Require real uploaded photos (No dummy/demo rooms allowed)
    if (this.newListingPhotos.length === 0) {
      this.showToast('📸 Please upload at least one real picture of your room before publishing!');
      const zone = document.querySelector('.photo-upload-zone');
      if (zone) {
        zone.scrollIntoView({ behavior: 'smooth' });
        zone.style.outline = '3px solid #ef4444';
        setTimeout(() => { zone.style.outline = ''; }, 2500);
      }
      return;
    }

    const title = document.getElementById('post-title').value.trim();
    const roomType = document.getElementById('post-room-type').value;
    const location = document.getElementById('post-location').value.trim();
    const address = document.getElementById('post-address').value.trim();
    const rentSplit = parseFloat(document.getElementById('post-rent-split').value) || 0;
    const roommatesNeeded = parseInt(document.getElementById('post-roommates-needed').value) || 1;
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

    const submitBtn = document.getElementById('post-room-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = this.editingListingId ? 'Saving Changes...' : 'Publishing Room...';
    }

    try {
      const photos = [...this.newListingPhotos];
      const cover = photos[this.coverPhotoIndex] || photos[0];

      if (this.editingListingId) {
        // Edit mode: update existing listing
        const updatePayload = {
          id: this.editingListingId,
          title,
          roomType,
          location,
          address,
          rentSplit,
          roommatesNeeded,
          deposit,
          availableFrom,
          smokingRule,
          drinkingRule,
          workingShiftPreference: shiftPref,
          genderPreference: genderPref,
          amenities,
          images: photos,
          coverImage: cover,
          description
        };

        const updated = await ListingsAPI.updateListing(updatePayload);
        const idx = this.listings.findIndex(l => l.id === this.editingListingId);
        if (idx > -1) {
          this.listings[idx] = { ...this.listings[idx], ...updated };
        }
        Storage.saveListings(this.listings);
        this.closeModal('modal-post-room');
        this.showToast('✅ Room listing updated successfully!');
      } else {
        // Create mode: publish newly created room
        const newListingData = {
          hostId: this.currentUser.id,
          hostName: this.currentUser.name,
          hostAvatar: this.currentUser.avatar || "",
          hostPhone: this.currentUser.phone || "98451 23456",
          hostEmail: this.currentUser.email || this.currentUser.gmail,
          hostOccupation: this.currentUser.occupation || "Working Professional",
          title,
          propertyType: "Apartment",
          roomType,
          location,
          neighborhood: location.split(',')[0].trim(),
          address,
          city: "Kerala",
          totalRent: rentSplit * (roommatesNeeded + 1),
          rentSplit,
          currency: "₹",
          deposit,
          billsIncluded: true,
          roommatesNeeded,
          genderPreference: genderPref,
          availableFrom,
          smokingRule,
          drinkingRule,
          workingShiftPreference: shiftPref,
          petPolicy: "yes",
          cleanlinessExpectation: "high",
          amenities: amenities.length > 0 ? amenities : ["High-Speed WiFi", "Washing Machine"],
          images: photos,
          coverImage: cover,
          description,
          status: "ACTIVE"
        };

        const published = await ListingsAPI.publishListing(newListingData);
        this.listings.unshift(published);
        Storage.saveListings(this.listings);
        this.closeModal('modal-post-room');
        // Exact user requirement message:
        this.showToast('🎉 Your room has been published successfully!');
      }

      this.newListingPhotos = [];
      this.coverPhotoIndex = 0;
      this.editingListingId = null;
      this.renderPostPhotoPreviews();

      // Immediately show in Available Properties without requiring a manual refresh
      this.renderListings();
      this.showMainView();
      this.switchTab('all');
      window.scrollTo({ top: 380, behavior: 'smooth' });
    } catch (err) {
      this.showToast(`⚠️ ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Room Listing';
      }
    }
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
