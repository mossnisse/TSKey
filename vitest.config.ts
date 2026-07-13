import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: {
                pretendToBeVisual: true,
                url: 'http://localhost/TSKey/',
            },
        },
        setupFiles: ['./tests/setup.ts'],
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            reportsDirectory: 'coverage',
            include: ['src/**/*.ts'],
            exclude: [
                'src/main.ts',
                'src/ui/shell.ts',
                'src/exporters/htmlLightboxAssets.ts',
            ],
        },
    },
});
