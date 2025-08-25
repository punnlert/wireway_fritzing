# BlinkBoard Code Integration

This document describes the integration between Fritzing's program tab and the BlinkBoard backend, allowing automatic code analysis whenever a program file is saved.

## Overview

The integration automatically sends the current code content from Fritzing's program tab to the BlinkBoard Node.js backend whenever a user saves a program file. This enables real-time code analysis and feedback.

## Implementation Details

### 1. Signal Chain

The integration follows this signal chain:

```
ProgramTab::save() → ProgramTab::codeSaved signal → ProgramWindow::codeSaved signal → MainWindow::handleCodeSaved slot → MainWindow::codeSaved signal → BlinkBoardWidget::sendCodeToBackend slot
```

### 2. Modified Files

#### `src/program/programtab.h`

- Added `codeSaved` signal declaration
- Added `sendCurrentCodeToBackend()` method declaration

#### `src/program/programtab.cpp`

- Modified `save(const QString& filename)` method to emit `codeSaved` signal
- Added `sendCurrentCodeToBackend()` method implementation

#### `src/program/programwindow.h`

- Added `codeSaved` signal declaration

#### `src/program/programwindow.cpp`

- Modified `prepSave()` method to emit `codeSaved` signal

#### `src/blinkboard/blinkboardwidget.h`

- Added `sendCodeToBackend()` method declaration
- Added `codeSaved` signal declaration

#### `src/blinkboard/blinkboardwidget.cpp`

- Added `sendCodeToBackend()` method implementation

#### `src/mainwindow/mainwindow.h`

- Added `codeSaved` signal declaration
- Added `connectProgramWindowToBlinkBoard()` method declaration
- Added `handleCodeSaved()` slot declaration
- Added `sendCurrentCodeToBackend()` method declaration

#### `src/mainwindow/mainwindow_menu.cpp`

- Added `connectProgramWindowToBlinkBoard()` method implementation
- Added `handleCodeSaved()` slot implementation
- Added `sendCurrentCodeToBackend()` method implementation
- Modified `openProgramWindow()` to connect signals

#### `src/mainwindow/mainwindow.cpp`

- Modified `initProgrammingWidget()` to connect signals

#### `src/mainwindow/mainwindow_dock.cpp`

- Added connection from MainWindow to BlinkBoardWidget

### 3. Key Methods

#### `BlinkBoardWidget::sendCodeToBackend()`

- Sends code content to Node.js backend via JSON command
- Command format: `{"command": "code_saved", "code": "...", "filename": "...", "platform": "...", "timestamp": ...}`
- Logs the action and shows user feedback

#### `BlinkBoardWidget::sendCurrentCodeToBackend()`

- Helper method that finds the current MainWindow and calls its `sendCurrentCodeToBackend()` method
- Used internally by `handleUpdateSchematics()` to send code along with schematic updates
- Ensures the backend always has the latest code context when processing schematic changes

#### `ProgramTab::save()`

- Automatically emits `codeSaved` signal after successful file save
- Includes code content, filename, and platform information

#### `MainWindow::handleCodeSaved()`

- Forwards code saved events from ProgramWindow to MainWindow signal
- Enables other components to listen for code save events

### 4. Automatic Triggers

The code is automatically sent to the backend when:

1. User saves a program file (Ctrl+S or File → Save)
2. User saves a program file with a new name (File → Save As)
3. Program is uploaded to hardware (triggers save first)
4. File is auto-saved
5. **User updates schematics (Update Schematics button)**

### 5. Manual Trigger

Users can manually send the current code to the backend by calling:

```cpp
mainWindow->sendCurrentCodeToBackend();
```

## Usage

### For Users

- No additional action required
- Code is automatically sent to backend on every save
- Backend receives: code content, filename, platform, and timestamp

### For Developers

- Backend receives JSON commands with `command: "code_saved"`
- Can implement code analysis, validation, or other processing
- Timestamp allows tracking of code evolution

### For Integration

- All signals are properly connected when windows are created
- Handles both standalone ProgramWindow and embedded ProgramView
- Gracefully handles cases where components don't exist

## Backend Integration

The Node.js backend should listen for commands with `command: "code_saved"` and process:

- `code`: The actual program code content
- `filename`: Name of the saved file
- `platform`: Programming platform (Arduino, Picaxe, etc.)
- `timestamp`: Unix timestamp of when the save occurred

## Error Handling

- Checks if Node.js backend is running before sending
- Provides user feedback if backend is not connected
- Gracefully handles missing or invalid data
- Logs all operations for debugging

## Future Enhancements

Potential improvements could include:

- Code diff analysis (what changed since last save)
- Syntax validation feedback
- Code quality metrics
- Integration with version control systems
- Real-time collaboration features
