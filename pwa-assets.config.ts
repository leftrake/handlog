import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PNG app icons from public/icon.svg: `npm run icons`.
const background = '#0f1a16'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
