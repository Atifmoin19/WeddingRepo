import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One page. "/" is the invitation, "/admin" is the host panel (see src/main.jsx and vercel.json).
export default defineConfig({ plugins: [react()] });
