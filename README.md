all the fritzing application build follows this [blog post](https://siytek.com/build-fritzing/)

## Dependencies

- cmake: which u can install using `brew install cmake` or if you dont have brew then `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"`
- libgit2
- boost
- fritzing-parts
- qt creator

## Dependencies Installation

### libgit2

```bash
cd libgit2 && mkdir build && cd build
cmake -DBUILD_SHARED_LIBS=OFF ..
cmake --build .
```

### boost

you dont have to compile boost i guess because it is a cpp library header-only

### fritzing-parts

clone it into the root of this project. this is parts that is used inside fritzing application.

```bash
git clone https://github.com/fritzing/fritzing-parts.git
```

### QT Creator

download it whatever way you prefer [here](https://doc.qt.io/qtcreator/creator-how-to-install.html)

you're gonna get a maintainance tool app for Qt (if cannot find, it's probably in ~/Qt/MaintainanceTool.app)

You should install qt version 5.15.19
select the following

![qt packages to install](./imgs/qt_deps.png)

### OpenAI env variables

navigate to `./fritzing-app/node-backend` and make a file named `.env`
then put your OpenAI credentials in with the name
OPENAI_API_KEY=<your api key>

## To start fritzing application

1. start QT creator and select "Open Project"
   ![fritzing-run-command-guide](./imgs/fritzing-start-1.png)
2. select the file "phoenix.pro" inside fritzing-app directory
3. build the project using "cmd+b" or click "build" in the left-bottom of the screen
4. click the "project" tab, click "run", then inside the command section, put this inside
   `-f "/path/to/fritzing-app/" -parts "/path/to/fritzing-parts/" -db "/path/to/fritzing-parts/parts.db"`
   dont forget to change the path to your application path
   ![fritzing-run-command-guide](./imgs/fritzing-start-2.png)
5. click "run"
