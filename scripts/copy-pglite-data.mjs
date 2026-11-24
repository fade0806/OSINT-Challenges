import { copyFileSync } from "node:fs";

const dest = ".vercel/output/functions/__server.func/_libs";
for (const name of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
  copyFileSync(`node_modules/@electric-sql/pglite/dist/${name}`, `${dest}/${name}`);
  console.log(`[pglite] copied ${name}`);
}
