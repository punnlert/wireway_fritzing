#include "platformarduino.h"
#include "programtab.h"

#include <QDir>
#include <QFileInfo>
#include <QProcess>

PlatformArduino::PlatformArduino() : Platform(QString("Arduino"))
{
	setReferenceUrl(QUrl(QString("http://arduino.cc/en/Reference/")));
	setIdeName("Arduino CLI");
	setDownloadUrl(QUrl("https://arduino.github.io/arduino-cli/"));
	setMinVersion("0.20.0");
	setCanProgram(true);
	setExtensions(QStringList() << ".ino" << ".pde");

	// Initialize member variables
	m_currentPort = "";
	m_currentBoard = "";
	m_currentFilePath = "";
	m_currentSource = nullptr;

	QMap<QString, QString> boards;
	// https://github.com/arduino/Arduino/blob/master/hardware/arduino/avr/boards.txt
	boards.insert("Arduino UNO", "arduino:avr:uno");
	boards.insert("Arduino Yún", "arduino:avr:yun");
	boards.insert("Arduino Mega/2560", "arduino:avr:mega");
	boards.insert("Arduino Duemilanove/Diecemila", "arduino:avr:diecimila");
	boards.insert("Arduino Nano", "arduino:avr:nano");
	boards.insert("Arduino Mega ADK", "arduino:avr:megaADK");
	boards.insert("Arduino Leonardo", "arduino:avr:leonardo");
	boards.insert("Arduino Micro", "arduino:avr:micro");
	boards.insert("Arduino Esplora", "arduino:avr:Esplora");
	boards.insert("Arduino Mini", "arduino:avr:mini");
	boards.insert("Arduino Ethernet", "arduino:avr:ethernet");
	boards.insert("Arduino Fio", "arduino:avr:fio");
	boards.insert("Arduino BT", "arduino:avr:bt");
	boards.insert("Lilypad Arduino USB", "arduino:avr:LilyPadUSB");
	boards.insert("LilyPad Arduino ", "arduino:avr:lilypad");
	boards.insert("Arduino Pro/Pro Mini", "arduino:avr:pro");
	boards.insert("Arduino NG or older", "arduino:avr:atmegang");
	boards.insert("Arduino Robot Control", "arduino:avr:robotControl");
	boards.insert("Arduino Robot Motor", "arduino:avr:robotMotor");
	boards.insert("Arduino Gemma", "arduino:avr:gemma");
	// https://github.com/arduino/Arduino/blob/master/hardware/arduino/sam/boards.txt
	boards.insert("Arduino Due (Programming Port)", "arduino:sam:arduino_due_x_dbg");
	boards.insert("Arduino Due (Native USB Port)", "arduino:sam:arduino_due_x");
	// Note: Edison, Galileo, 101 are programmed via Arduino IDE Add-ons,
	//       not sure if the command line is supported for them
	setBoards(boards);

	setDefaultBoardName("Arduino UNO");
}

void PlatformArduino::upload(QWidget *source, const QString &port, const QString &board, const QString &fileLocation)
{
	// Store current upload parameters for use in lambdas
	m_currentPort = port;
	m_currentBoard = board;
	m_currentFilePath = fileLocation;
	m_currentSource = source;

	// Make sure .ino is in its own folder with same name (as required by Arduino compiler),
	// otherwise create a subfolder and copy the file there.
	QFileInfo fileInfo(fileLocation);
	QString tmpFilePath = fileInfo.absoluteFilePath();
	QString dirName = fileInfo.dir().dirName();
	QString sketchName = fileInfo.baseName();
	if (dirName.compare(sketchName, Qt::CaseInsensitive) != 0) {
		QString tmpSketchName(sketchName.append("_TMP"));
		fileInfo.dir().mkdir(tmpSketchName);
		tmpFilePath = fileInfo.absolutePath().append("/").append(tmpSketchName).append("/")
		              .append(fileInfo.baseName().append("_TMP.").append(fileInfo.suffix()));
		if (QFile::exists(tmpFilePath)) QFile::remove(tmpFilePath);
		QFile::copy(fileInfo.absoluteFilePath(), tmpFilePath);
	}

	// Store the temporary file path for use in upload
	m_currentFilePath = tmpFilePath;

	// First compile the sketch
	QProcess * compileProcess = new QProcess(this);
	compileProcess->setProcessChannelMode(QProcess::MergedChannels);
	compileProcess->setReadChannel(QProcess::StandardOutput);
	
	// Connect signals for compilation process using lambda functions
	connect(compileProcess, static_cast<void(QProcess::*)(int, QProcess::ExitStatus)>(&QProcess::finished), 
	        [=](int exitCode, QProcess::ExitStatus exitStatus) {
		compileProcess->deleteLater();
		
		if (exitCode == 0) {
			// Compilation successful, proceed with upload
			ProgramTab *tab = qobject_cast<ProgramTab *>(m_currentSource);
			if (tab) {
				tab->appendToConsole(tr("✓ Compilation successful!"));
				tab->appendToConsole(tr("Step 2: Uploading to board..."));
			}
			
			// Start upload process
			QProcess * uploadProcess = new QProcess(this);
			uploadProcess->setProcessChannelMode(QProcess::MergedChannels);
			uploadProcess->setReadChannel(QProcess::StandardOutput);
			connect(uploadProcess, SIGNAL(finished(int, QProcess::ExitStatus)), m_currentSource, SLOT(programProcessFinished(int, QProcess::ExitStatus)));
			connect(uploadProcess, SIGNAL(readyReadStandardOutput()), m_currentSource, SLOT(programProcessReadyRead()));
			
			QStringList uploadArgs;
			// arduino-cli upload syntax: arduino-cli upload -p <port> --fqbn <board> <sketch>
			uploadArgs.append(QString("upload"));
			uploadArgs.append(QString("-p"));
			uploadArgs.append(m_currentPort);
			uploadArgs.append(QString("--fqbn"));
			uploadArgs.append(getBoards().value(m_currentBoard));
			uploadArgs.append(QDir::toNativeSeparators(m_currentFilePath));
			
			ProgramTab *uploadTab = qobject_cast<ProgramTab *>(m_currentSource);
			if (uploadTab) {
				uploadTab->appendToConsole(tr("Running %1 %2").arg(getCommandLocation()).arg(uploadArgs.join(" ")));
			}
			uploadProcess->start(getCommandLocation(), uploadArgs);
		} else {
			// Compilation failed - re-enable the program button
			ProgramTab *tab = qobject_cast<ProgramTab *>(m_currentSource);
			if (tab) {
				tab->appendToConsole(tr("Compilation failed with exit code %1. Upload aborted.").arg(exitCode));
				// Re-enable the program button since compilation failed
				tab->reenableProgramButton();
			}
		}
	});
	
	connect(compileProcess, &QProcess::readyReadStandardOutput, 
	        [=]() {
		QByteArray output = compileProcess->readAllStandardOutput();
		ProgramTab *tab = qobject_cast<ProgramTab *>(m_currentSource);
		if (tab) {
			tab->appendToConsole(QString::fromUtf8(output));
		}
	});
	
	QStringList compileArgs;
	// arduino-cli compile syntax: arduino-cli compile --fqbn <board> <sketch>
	compileArgs.append(QString("compile"));
	compileArgs.append(QString("--fqbn"));
	compileArgs.append(getBoards().value(board));
	compileArgs.append(QDir::toNativeSeparators(tmpFilePath));
	
	ProgramTab *tab = qobject_cast<ProgramTab *>(source);
	if (tab) {
		tab->appendToConsole(tr("=== Starting Arduino CLI Upload Process ==="));
		tab->appendToConsole(tr("Step 1: Compiling sketch..."));
		tab->appendToConsole(tr("Running %1 %2").arg(getCommandLocation()).arg(compileArgs.join(" ")));
	}
	compileProcess->start(getCommandLocation(), compileArgs);
}

void PlatformArduino::compile(QWidget *source, const QString &board, const QString &fileLocation)
{
	QProcess * process = new QProcess(this);
	process->setProcessChannelMode(QProcess::MergedChannels);
	process->setReadChannel(QProcess::StandardOutput);
	connect(process, SIGNAL(finished(int, QProcess::ExitStatus)), source, SLOT(programProcessFinished(int, QProcess::ExitStatus)));
	connect(process, SIGNAL(readyReadStandardOutput()), source, SLOT(programProcessReadyRead()));

	// Make sure .ino is in its own folder with same name (as required by Arduino compiler),
	// otherwise create a subfolder and copy the file there.
	QFileInfo fileInfo(fileLocation);
	QString tmpFilePath = fileInfo.absoluteFilePath();
	QString dirName = fileInfo.dir().dirName();
	QString sketchName = fileInfo.baseName();
	if (dirName.compare(sketchName, Qt::CaseInsensitive) != 0) {
		QString tmpSketchName(sketchName.append("_TMP"));
		fileInfo.dir().mkdir(tmpSketchName);
		tmpFilePath = fileInfo.absolutePath().append("/").append(tmpSketchName).append("/")
		              .append(fileInfo.baseName().append("_TMP.").append(fileInfo.suffix()));
		if (QFile::exists(tmpFilePath)) QFile::remove(tmpFilePath);
		QFile::copy(fileInfo.absoluteFilePath(), tmpFilePath);
	}

	QStringList args;
	// arduino-cli compile syntax: arduino-cli compile --fqbn <board> <sketch>
	args.append(QString("compile"));
	args.append(QString("--fqbn"));
	args.append(getBoards().value(board));
	args.append(QDir::toNativeSeparators(tmpFilePath));

	ProgramTab *tab = qobject_cast<ProgramTab *>(source);
	if (tab)
		tab->appendToConsole(tr("Running %1 %2").arg(getCommandLocation()).arg(args.join(" ")));
	process->start(getCommandLocation(), args);
}
