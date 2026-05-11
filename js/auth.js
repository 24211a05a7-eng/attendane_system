/**
 * Frontend Auth Service
 * Interacts with the Express Backend built in /server
 */

const API_BASE_URL = '/api/auth';

const AuthService = {
    /**
     * Get the current JWT token from localStorage
     */
    getToken() {
        return localStorage.getItem('placenix_jwt');
    },

    /**
     * Set the JWT token locally
     */
    setToken(token) {
        if (token) {
            localStorage.setItem('placenix_jwt', token);
        } else {
            localStorage.removeItem('placenix_jwt');
        }
    },

    /**
     * Set the current user's profile info locally
     */
    setUser(user) {
        if (user) {
            localStorage.setItem('placenix_user_profile', JSON.stringify(user));
        } else {
            localStorage.removeItem('placenix_user_profile');
        }
    },

    getUser() {
        const str = localStorage.getItem('placenix_user_profile');
        return str ? JSON.parse(str) : null;
    },

    /**
     * Helper for standardized API requests
     */
    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method,
            headers
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'API Request Failed');
            }
            
            return data;
        } catch (error) {
            console.error(`[Auth API Error] ${method} ${endpoint}:`, error);
            throw error;
        }
    },

    // ─── AUTH METHODS ───

    async signup(userData) {
        // userData: { name, email, mobile, college, branch, year, password }
        const data = await this.apiCall('/signup', 'POST', userData);
        if (data.token) {
            this.setToken(data.token);
            this.setUser(data.user);
        }
        return data;
    },

    async login(email, password) {
        const data = await this.apiCall('/login', 'POST', { email, password });
        if (data.token) {
            this.setToken(data.token);
            this.setUser(data.user);
        }
        return data;
    },

    async sendOTP(email) {
        return await this.apiCall('/send-otp', 'POST', { email });
    },

    async verifyOTP(email, code) {
        const data = await this.apiCall('/verify-otp', 'POST', { email, code });
        if (data.token) {
            this.setToken(data.token);
            this.setUser(data.user);
        }
        return data;
    },

    async getProfile() {
        return await this.apiCall('/me', 'GET');
    },

    async logout() {
        try {
            // Optional: call backend to invalidate token if backend supported it
            await this.apiCall('/logout', 'POST').catch(e => {
                // Ignore failure on logout, just clear local state anyway
            });
        } finally {
            this.setToken(null);
            this.setUser(null);
            localStorage.removeItem('placenix_user'); // the old key
            window.location.reload(); // Refresh the page to reset state
        }
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    async recordSolve(questionId, xp = 10) {
        if (!this.isAuthenticated()) return null;
        return await this.apiCall('/progress/solve', 'POST', { questionId, xp });
    },

    async toggleBookmark(questionId) {
        if (!this.isAuthenticated()) return null;
        return await this.apiCall('/progress/bookmark', 'POST', { questionId });
    }
};

window.AuthService = AuthService;
