xxHash64 implementation in JS.

## Examples

### Hashing in one step

```js
import { hash } from '@intrnl/xxhash64';

hash('foobar', 0); // 11721187498075204345n
```

### Hashing in multiple steps

```js
import { XXH64 } from '@intrnl/xxhash64';

const hash = new XXH64();

hash.update('foo');

hash.update('bar');

hash.digest(); // 11721187498075204345n
```
