import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                company: resolve(__dirname, 'company.html'),
                dashboard: resolve(__dirname, 'dashboard.html'),
                feedback: resolve(__dirname, 'feedback.html'),
                interview: resolve(__dirname, 'interview.html'),
                login: resolve(__dirname, 'login.html'),
                questionbank: resolve(__dirname, 'questionbank.html'),
                resume: resolve(__dirname, 'resume.html'),
                trial: resolve(__dirname, 'trial.html')
            }
        }
    },
    server: {
        port: 8080,
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
