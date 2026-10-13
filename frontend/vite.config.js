import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        server: {
            port: 5173,
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: env.VITE_API_BASE_URL || 'http://localhost:5000',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        preview: {
            host: '0.0.0.0',
            port: 4173,
        },
        build: {
            sourcemap: mode !== 'production',
        },
    };
});
