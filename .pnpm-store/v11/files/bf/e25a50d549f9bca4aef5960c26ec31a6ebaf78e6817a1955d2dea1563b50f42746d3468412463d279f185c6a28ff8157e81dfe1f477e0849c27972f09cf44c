# Virtual Merge

A utility library to merge multiple Objects virtually

```sh
npm install virtual-merge
yarn add virtual-merge
pnpm add virtual-merge
```

Imagine having multiple Objects and wanting to merge those. The usual way to accomplish this is to do
```js
const merged = { ...obj1, ...obj2, ...obj3 };
```
However, changes made on `merged` will not reflect back to the original Objects.
This might be desired, in which case sweet, you don't need this module!

However, if you do want those changes to reflect back to the original object, you can use this module!

## Example

```js
import virtualMerge from "virtual-merge";
// or commonjs
const virtualMerge = require("virtual-merge");

const obj1 = { im: "so cool" };
const obj2 = { hamburgers: "are delicious!" };

const merged = virtualMerge(obj1, obj2);

merged.im = "so cute!";
console.log(merged.im); // "so cute!"
console.log(obj1.im); // "so cute!"

obj1.im = "awesome!";
console.log(merged.im); // "awesome!"

// new properties work too!
merged.someNewProperty = "wow this is in neither of the objects O_O";
console.log(merged.someNewProperty); // "wow this is in neither of the objects O_O"
console.log(obj1.someNewProperty); // undefined
console.log(obj2.someNewProperty); // undefined

// and of course, the usual object methods still work fine!
console.log(Object.keys(merged)); // ["someNewProperty", "im", "hamburgers"]
console.log("im" in merged); // true
console.log(Object.hasOwn(merged, "hamburgers")); // true
```

## License

MIT - Copyright (c) 2023 Vendicated
