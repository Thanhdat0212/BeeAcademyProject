import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['motion/react', 'lucide-react'],
            'vendor-utils': ['axios', 'zustand'],
            'pages-admin': [
              './src/pages/admin/DashboardAdmin',
              './src/pages/admin/ApprovalsPage',
              './src/pages/admin/CourseReviewPage',
            ],
            'pages-teacher': [
              './src/pages/teacher/CoursesPage',
              './src/pages/teacher/QuestionBankPage',
              './src/pages/teacher/QuizPage',
              './src/pages/teacher/RevenuePage',
              './src/pages/teacher/BankPage',
            ],
          },
        },
      },
    },
  };
});
