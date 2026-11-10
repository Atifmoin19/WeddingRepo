import { defineConfig } from "vite";

// Two pages: the invitation (index.html) and the host-only guest links page (admin.html).
export default defineConfig({
  build: { rollupOptions: { input: { main: "index.html", admin: "admin.html" } } },
});
