import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// esbuild 不产出 design:paramtypes，Nest DI 测试必须经 SWC 转译（spec §5.7）
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["test/**/*.e2e.spec.ts", "src/**/*.spec.ts"],
    testTimeout: 30000,
  },
});
