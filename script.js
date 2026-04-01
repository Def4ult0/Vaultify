document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Routing & Overlay Logic ---
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    // Landing DOM
    const landingPage = document.getElementById('landingPage');
    const appContainer = document.getElementById('appContainer');

    function checkAuth() {
        if (localStorage.getItem('vaultify_auth') === 'true') {
            landingPage.style.display = 'none';
            appContainer.style.display = 'flex';
            loginOverlay.classList.remove('active');

            // Sync saved profile from local storage if exists
            const savedName = localStorage.getItem('profileName');
            const savedImg = localStorage.getItem('profileImg');

            const profileImgNode = document.querySelector('.profile-icon img');
            const welcomeTextNode = document.querySelector('.welcome-text h1');

            if (savedImg && profileImgNode) profileImgNode.src = savedImg;
            if (savedName && welcomeTextNode) welcomeTextNode.textContent = `Welcome back, ${savedName}`;
            
            // Re-load the specific items for this securely logged in user
            if (typeof window.loadItemsForUser === 'function') window.loadItemsForUser();

        } else {
            landingPage.style.display = 'block';
            appContainer.style.display = 'none';
            loginOverlay.classList.remove('active');
        }
    }
    checkAuth(); // Initial Check
    setTimeout(() => { if (localStorage.getItem('vaultify_auth') === 'true' && typeof window.loadItemsForUser === 'function') window.loadItemsForUser(); }, 200);

    // Handle Supabase Auth (e.g. Google OAuth Redirects)
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                const user = session.user;
                const metadata = user.user_metadata || {};
                const fullName = metadata.full_name || metadata.name || 'Google User';
                const avatarUrl = metadata.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`;

                localStorage.setItem('vaultify_auth', 'true');
                localStorage.setItem('profileName', fullName);
                localStorage.setItem('profileImg', avatarUrl);

                checkAuth();
            } else if (event === 'PASSWORD_RECOVERY') {
                const resetPasswordOverlay = document.getElementById('resetPasswordOverlay');
                if (resetPasswordOverlay) {
                    resetPasswordOverlay.classList.add('active');
                    resetPasswordOverlay.style.display = 'flex';
                }
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('vaultify_auth');
                localStorage.removeItem('profileName');
                localStorage.removeItem('profileImg');
                const welcomeTextNode = document.querySelector('.welcome-text h1');
                const profileImgNode = document.querySelector('.profile-icon img');
                if(welcomeTextNode) welcomeTextNode.textContent = 'Welcome back, User';
                if(profileImgNode) profileImgNode.src = 'https://ui-avatars.com/api/?name=User&background=18181b&color=fff';
                checkAuth();
            }
        });
    }

    // Auth Actions
    document.querySelectorAll('#navLoginBtn, #navJoinBtn, #heroJoinBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            loginOverlay.classList.add('active');
        });
    });

    document.getElementById('closeLoginBtn').addEventListener('click', () => {
        loginOverlay.classList.remove('active');
    });

    const googleBtn = document.getElementById('googleBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            showToast("Redirecting to Google...", "success");
            
            const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
                provider: 'google',
            });
            
            if (error) {
                console.error("Google Auth Error:", error.message);
                showToast("Failed to connect to Google", "error");
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = loginForm.querySelector('input[type="email"]');
        const passwordInput = loginForm.querySelector('input[type="password"]');
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        
        if (!emailInput || !passwordInput) return;
        
        const email = emailInput.value;
        const password = passwordInput.value;
        
        // Use Supabase for real email/password auth
        if (window.supabaseClient) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            let { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password,
            });

            // If invalid credentials, gracefully attempt to register them instead
            // (since the button is "Sign In / Sign Up")
            if (error && error.message.includes("Invalid login credentials")) {
                const signupResponse = await window.supabaseClient.auth.signUp({
                    email,
                    password,
                });
                
                data = signupResponse.data;
                error = signupResponse.error;
                
                // Supabase defaults to requiring email confirmation
                if (!error && data.user && !data.session) {
                    showToast("Account created! Check your email to verify.", "success");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In / Sign Up';
                    return;
                }
            }

            if (error) {
                showToast("Error: " + error.message, "error");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In / Sign Up';
                return;
            }

            // Success (session exists)
            if (data && data.session) {
                const usernameParts = email.split('@')[0].split(/[.\-_]/);
                let extractedName = usernameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                if (!extractedName.trim()) extractedName = 'User';
                
                const avatarUrl = data.user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(extractedName)}&background=random&color=fff`;
                
                localStorage.setItem('profileName', extractedName);
                localStorage.setItem('profileImg', avatarUrl);
                localStorage.setItem('vaultify_auth', 'true');
                
                checkAuth();
                showToast("Logged in successfully", "success");
            }

            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In / Sign Up';
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Sign out of Supabase if active
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
        
        localStorage.removeItem('vaultify_auth');
        localStorage.removeItem('profileName');
        localStorage.removeItem('profileImg');
        
        // Reset dom to avoid old user flash on next relogin
        const welcomeTextNode = document.querySelector('.welcome-text h1');
        const profileImgNode = document.querySelector('.profile-icon img');
        if(welcomeTextNode) welcomeTextNode.textContent = 'Welcome back, User';
        if(profileImgNode) profileImgNode.src = 'https://ui-avatars.com/api/?name=User&background=18181b&color=fff';

        // Start totally fresh for next login block
        if (typeof items !== 'undefined') {
            items = [];
            if (typeof renderItems === 'function') renderItems();
            if (typeof updateStats === 'function') updateStats();
        }

        checkAuth();
        showToast("Logged out", "success");
    });

    // --- Interactive Sidebar Links ---
    document.querySelectorAll('.sidebar-nav a, .sidebar-footer a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href') === '#') {
                e.preventDefault();

                if (link.id === 'logoutBtn') return;

                const textNode = link.querySelector('span');
                const text = textNode ? textNode.innerText : 'Unknown';

                const catMap = {
                    'Movies': 'movies',
                    'Music': 'music',
                    'Games': 'games',
                    'Photos': 'photos',
                    'Links': 'links'
                };

                document.querySelectorAll('.sidebar-nav li, .sidebar-footer li').forEach(li => li.classList.remove('active'));
                if (link.parentElement.tagName === 'LI') {
                    link.parentElement.classList.add('active');
                }

                if (catMap[text]) {
                    currentFilter = catMap[text];
                    document.querySelectorAll('.filter-btn').forEach(b => {
                        b.classList.remove('active');
                        if (b.dataset.filter === catMap[text]) b.classList.add('active');
                    });
                    renderItems();
                } else if (text === 'Dashboard') {
                    currentFilter = 'all';
                    document.querySelectorAll('.filter-btn').forEach(b => {
                        b.classList.remove('active');
                        if (b.dataset.filter === 'all') b.classList.add('active');
                    });
                    renderItems();
                } else if (text === 'Settings') {
                    openProfileModal();
                }
            }
        });
    });

    // Profile Image Clickable
    const profileImg = document.querySelector('.profile-icon img');
    if (profileImg) {
        profileImg.addEventListener('click', () => {
            openProfileModal();
        });
    }

    // --- Profile Modal Logic ---
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    const profileForm = document.getElementById('profileForm');
    const profileImageInput = document.getElementById('profileImageInput');
    const modalProfileImgPreview = document.getElementById('modalProfileImgPreview');
    const profileNameInput = document.getElementById('profileNameInput');

    let currentProfileBase64 = null;

    function openProfileModal() {
        currentProfileBase64 = localStorage.getItem('profileImg') || "https://ui-avatars.com/api/?name=User&background=18181b&color=fff";
        modalProfileImgPreview.src = currentProfileBase64;
        profileNameInput.value = localStorage.getItem('profileName') || "User";
        profileModal.classList.add('active');
    }

    function closeProfileModal() {
        profileModal.classList.remove('active');
    }

    closeProfileBtn.addEventListener('click', closeProfileModal);
    cancelProfileBtn.addEventListener('click', closeProfileModal);
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            closeProfileModal();
        }
    });

    profileImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentProfileBase64 = ev.target.result;
                modalProfileImgPreview.src = currentProfileBase64;
            };
            reader.readAsDataURL(file);
        }
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = profileNameInput.value || "User";

        // Save to cache
        localStorage.setItem('profileName', newName);
        localStorage.setItem('profileImg', currentProfileBase64);

        if (profileImg) profileImg.src = currentProfileBase64;

        const welcomeText = document.querySelector('.welcome-text h1');
        if (welcomeText) welcomeText.textContent = `Welcome back, ${newName}`;

        showToast("Profile updated successfully!");
        closeProfileModal();
    });

    // --- State ---
    let items = [];

    // Save strictly to the current active profile to avoid data leaks
    function saveItems() {
        const currentUser = localStorage.getItem('profileName') || 'Guest';
        localStorage.setItem(`vaultify_items_${currentUser}`, JSON.stringify(items));
    }

    // Refresh memory when a new user signs in securely
    window.loadItemsForUser = function() {
        const currentUser = localStorage.getItem('profileName') || 'Guest';
        items = JSON.parse(localStorage.getItem(`vaultify_items_${currentUser}`)) || [];
        if (typeof renderItems === 'function') renderItems();
        if (typeof updateStats === 'function') updateStats();
    };

    const contentGrid = document.getElementById('contentGrid');
    const statTotal = document.getElementById('statTotal');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Global filter/search states
    let currentFilter = 'all';
    let currentQuery = '';

    // Search logic
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentQuery = e.target.value.toLowerCase();
            renderItems();
        });
    }

    // --- Render Content ---
    function renderItems() {
        contentGrid.innerHTML = '';

        // Apply category filter
        let filteredItems = currentFilter === 'all' ? items : items.filter(item => item.category === currentFilter);

        // Apply search query
        if (currentQuery) {
            filteredItems = filteredItems.filter(item => item.title.toLowerCase().includes(currentQuery));
        }

        filteredItems.forEach(item => {
            const starsHtml = Array(5).fill(0).map((_, i) =>
                `<i class="${i < item.rating ? 'ph-fill ph-star active-star' : 'ph ph-star'}"></i>`
            ).join('');

            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `
                <div class="card-image">
                    <img src="${item.img || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop'}" alt="${item.title}">
                    <div class="card-overlay">
                        <div class="card-actions">
                            <button title="Edit" data-id="${item.id}" class="action-edit"><i class="ph ph-pencil-simple"></i></button>
                            <button title="Delete" data-id="${item.id}" class="action-delete"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <div class="card-header">
                        <h3 class="card-title">${item.title}</h3>
                        <span class="card-category">${item.category}</span>
                    </div>
                    <div class="card-rating">
                        ${starsHtml}
                    </div>
                    <p class="card-note">${item.notes}</p>
                </div>
            `;

            // Delete listener
            card.querySelector('.action-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this item?')) {
                    items = items.filter(i => i.id !== item.id);
                    saveItems();
                    renderItems();
                    updateStats();
                    showToast("Item deleted", "success");
                }
            });

            // Edit listener
            card.querySelector('.action-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(item);
            });

            contentGrid.appendChild(card);
        });

        if (filteredItems.length === 0) {
            if (currentFilter === 'all' && currentQuery === '') {
                contentGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <i class="ph ph-package" style="font-size: 48px; color: var(--text-muted); margin-bottom: 16px; display: block;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Your vault is empty</h3>
                    <p style="color: var(--text-secondary);">Your centralized media hub is standing by. Click "Add Item" in the corner to begin.</p>
                </div>`;
            } else {
                contentGrid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 40px;">No items found matching your filters.</p>`;
            }
        }
    }

    function updateStats() {
        statTotal.textContent = items.length;
    }

    // --- Filters ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.dataset.filter;

            // Sync sidebar
            document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));

            const catReverseMap = { 'movies': 'Movies', 'music': 'Music', 'games': 'Games', 'photos': 'Photos', 'links': 'Links' };
            const friendlyName = catReverseMap[currentFilter];

            document.querySelectorAll('.sidebar-nav span').forEach(span => {
                if (span.innerText === friendlyName) {
                    span.parentElement.parentElement.classList.add('active');
                } else if (currentFilter === 'all' && span.innerText === 'Dashboard') {
                    span.parentElement.parentElement.classList.add('active');
                }
            });

            renderItems();
        });
    });

    // --- Setup & Initialization ---
    renderItems();
    updateStats();

    // --- Theme Toggle ---
    const themeToggle = document.getElementById('themeToggle');
    const landingThemeToggle = document.getElementById('landingThemeToggle');
    const htmlEl = document.documentElement;
    const currentTheme = localStorage.getItem('theme') || 'dark';

    function applyThemeIcons(isLight) {
        const icon = isLight ? '<i class="ph ph-moon"></i>' : '<i class="ph ph-sun"></i>';
        if (themeToggle) themeToggle.innerHTML = icon;
        if (landingThemeToggle) landingThemeToggle.innerHTML = icon;
    }

    if (currentTheme === 'light') {
        htmlEl.classList.add('light');
        applyThemeIcons(true);
    } else {
        htmlEl.classList.remove('light');
        applyThemeIcons(false);
    }

    function toggleTheme() {
        htmlEl.classList.toggle('light');
        const isLight = htmlEl.classList.contains('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyThemeIcons(isLight);
    }

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (landingThemeToggle) landingThemeToggle.addEventListener('click', toggleTheme);

    // --- Sidebar Toggle ---
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // --- Modal Logic ---
    const modal = document.getElementById('addItemModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const addItemForm = document.getElementById('addItemForm');
    const modalTitle = document.getElementById('modalTitle');
    const editItemId = document.getElementById('editItemId');

    let currentItemBase64 = null;

    document.getElementById('itemImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentItemBase64 = ev.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            currentItemBase64 = null;
        }
    });

    function openModal() {
        modalTitle.textContent = "Add to Vaultify";
        editItemId.value = "";
        currentItemBase64 = null;
        modal.classList.add('active');
    }

    function openEditModal(item) {
        modalTitle.textContent = "Edit Item";
        editItemId.value = item.id;

        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemNotes').value = item.notes;

        currentItemBase64 = item.img;
        resetRating(item.rating);

        modal.classList.add('active');
    }

    function closeModal() {
        modal.classList.remove('active');
        addItemForm.reset();
        editItemId.value = "";
        currentItemBase64 = null;
        resetRating();
    }

    openModalBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- Rating Logic in Form ---
    const stars = document.querySelectorAll('#ratingInput i');
    const ratingInputVal = document.getElementById('itemRating');

    function resetRating(rating = 4) {
        ratingInputVal.value = rating;
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.replace('ph', 'ph-fill');
                star.style.color = "var(--text-primary)";
            } else {
                star.classList.replace('ph-fill', 'ph');
                star.style.color = "var(--text-muted)";
            }
        });
    }

    stars.forEach((star, index) => {
        star.addEventListener('mouseover', () => {
            const hoverVal = index + 1;
            stars.forEach((s, i) => {
                if (i < hoverVal) {
                    s.classList.replace('ph', 'ph-fill');
                    s.style.color = "var(--text-primary)";
                } else {
                    s.classList.replace('ph-fill', 'ph');
                    s.style.color = "var(--text-muted)";
                }
            });
        });

        star.addEventListener('mouseout', () => {
            resetRating(parseInt(ratingInputVal.value));
        });

        star.addEventListener('click', () => {
            ratingInputVal.value = index + 1;
            resetRating(index + 1);
        });
    });

    resetRating();

    // --- Form Submit ---
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = addItemForm.querySelector('button[type="submit"]');
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Saving...";

        const title = document.getElementById('itemTitle').value;
        const category = document.getElementById('itemCategory').value;
        const notes = document.getElementById('itemNotes').value;
        const rating = parseInt(document.getElementById('itemRating').value);

        const newItem = {
            title,
            type: category,
            notes,
            rating
        };

        // 🔥 SEND TO SUPABASE
        const { data, error } = await window.supabaseClient
            .from("items")
            .insert([newItem])
            .select();

        if (error) {
            console.error(error);
            showToast("Error saving item ❌", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        console.log("Saved to DB:", data);

        // ✅ ALSO KEEP LOCAL UI WORKING
        items.unshift({
            ...newItem,
            id: Date.now(),
            category,
            img: currentItemBase64 || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600"
        });

        saveItems();
        renderItems();
        updateStats();
        closeModal();

        showToast("Item added 🔥", "success");
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });

    // --- Toast Notification ---
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';

        let iconClass = 'ph-check-circle';
        if (type === 'error') iconClass = 'ph-x-circle';

        toast.innerHTML = `
            <i class="ph-fill ${iconClass}" style="color: ${type === 'error' ? 'var(--danger)' : 'var(--success)'}; font-size: 18px;"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        // trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // --- Addictive Cursor Glow ---
    const cursorGlow = document.getElementById('cursorGlow');
    if (cursorGlow) {
        document.addEventListener('mousemove', (e) => {
            if (landingPage.style.display !== 'none') {
                cursorGlow.style.opacity = '1';
                cursorGlow.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`;
            } else {
                cursorGlow.style.opacity = '0';
            }
        });
    }

    // --- Forgot Password Logic ---
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailInput = loginForm.querySelector('input[type="email"]');
            const email = emailInput ? emailInput.value.trim() : '';
            
            if (!email) {
                showToast("Please enter your email address first to reset password.", "error");
                return;
            }

            if (window.supabaseClient) {
                showToast("Requesting password reset...", "success");
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.href,
                });

                if (error) {
                    showToast("Error: " + error.message, "error");
                } else {
                    showToast("Password reset link sent to your email!", "success");
                }
            }
        });
    }

    // --- Reset Password Form Logic ---
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const closeResetPasswordBtn = document.getElementById('closeResetPasswordBtn');
    const resetPasswordOverlay = document.getElementById('resetPasswordOverlay');

    if (closeResetPasswordBtn) {
        closeResetPasswordBtn.addEventListener('click', () => {
            resetPasswordOverlay.classList.remove('active');
            setTimeout(() => { resetPasswordOverlay.style.display = ''; }, 300);
        });
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPasswordInput = document.getElementById('newPasswordInput');
            const newPassword = newPasswordInput.value;
            const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');

            if (!newPassword || newPassword.length < 6) {
                showToast("Password must be at least 6 characters.", "error");
                return;
            }

            if (window.supabaseClient) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';

                const { data, error } = await window.supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (error) {
                    showToast("Error: " + error.message, "error");
                } else {
                    showToast("Password updated successfully!", "success");
                    resetPasswordOverlay.classList.remove('active');
                    setTimeout(() => { resetPasswordOverlay.style.display = ''; }, 300);
                }

                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }
        });
    }
});