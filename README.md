all the fritzing application build follows this [blog post](https://siytek.com/build-fritzing/)
## Dependencies
- cmake: which u can install using `brew install cmake` or if you dont have brew then `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
- libgit2
- boost

## Dependencies Installation
### libgit2
```bash
$ cd libgit2 && mkdir build && cd build
$ cmake ..
$ cmake --build .
```

### boost
you dont have to compile boost i guess because it is a cpp library header-only
