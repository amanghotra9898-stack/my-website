# Vendored: @noble/hashes 1.8.0

Source: https://github.com/paulmillr/noble-hashes (npm `@noble/hashes@1.8.0`, ESM build `esm/`), MIT licence (see LICENSE).
Used only by `/admin/scrypt-worker.js` for the browser-side scrypt in admin sign-in.

Files copied unchanged except one line in `utils.js` (line 12):
`import { crypto } from '@noble/hashes/crypto';` → `import { crypto } from './crypto.js';`
(browsers cannot resolve bare package names without a build step).

SHA-256 of the original npm files:
```
3024613698852b588d45a59b56b7204d9612a638805693bdb99f545dc65bdf91  scrypt.js
dab190f2112ba5fdef75fe027aecc1183a79bad3cdffdf42014c40ecc75bbf78  pbkdf2.js
e729088b82e5450bff54c3a0013582aa42e1fe8f58dd31f5967f6ebe34c52299  sha2.js
a330af1af3fb00ebdbba2f023dd5e023aa367669081cd51c7d172eb499533d0b  hmac.js
cefb1557e7715cb2117c83f82ef3e3175c7e0391c80bd5795b2d4effc45fc582  _md.js
e48c0cfc10810439a4807b46db136ce603a3fa09b62584f513ef2f3ca496af54  _u64.js
4cf4c1e05affedcb4fd584a43d76ae1a3711e34a36e2251b90c27e33ecc74fad  utils.js
9211d026c5d21e60e0126dd6f01150d87da5ba7261b8f468215c1264372ff5a5  crypto.js
```

SHA-256 of the files as shipped here:
```
cefb1557e7715cb2117c83f82ef3e3175c7e0391c80bd5795b2d4effc45fc582  _md.js
e48c0cfc10810439a4807b46db136ce603a3fa09b62584f513ef2f3ca496af54  _u64.js
9211d026c5d21e60e0126dd6f01150d87da5ba7261b8f468215c1264372ff5a5  crypto.js
a330af1af3fb00ebdbba2f023dd5e023aa367669081cd51c7d172eb499533d0b  hmac.js
dab190f2112ba5fdef75fe027aecc1183a79bad3cdffdf42014c40ecc75bbf78  pbkdf2.js
3024613698852b588d45a59b56b7204d9612a638805693bdb99f545dc65bdf91  scrypt.js
e729088b82e5450bff54c3a0013582aa42e1fe8f58dd31f5967f6ebe34c52299  sha2.js
6939d5778fbd4a10feb224e1b9158ea59fb160b59dcaa43ea2ebb49f85c3b4ce  utils.js
```
