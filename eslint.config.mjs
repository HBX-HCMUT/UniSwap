import eslint from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**"] },
  eslint.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
