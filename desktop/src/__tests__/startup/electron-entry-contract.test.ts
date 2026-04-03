import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type DesktopPackageManifest = {
  main?: string;
};

describe("desktop package entry contract", () => {
  it("points Electron main entry to electron-vite output", () => {
    const packageJsonPath = resolve(__dirname, "../../../package.json");
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    ) as DesktopPackageManifest;

    expect(packageJson.main).toBe("out/main/main.js");
  });
});
