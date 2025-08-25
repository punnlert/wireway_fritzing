#include "platform.h"

#include <QString>
#include <QProcess>

// Forward declaration
class QWidget;

#ifndef PLATFORMARDUINO_H
#define PLATFORMARDUINO_H

class PlatformArduino : public Platform
{
public:
	PlatformArduino();

	void upload(QWidget *source, const QString &port, const QString &board, const QString &fileLocation);
	void compile(QWidget *source, const QString &board, const QString &fileLocation);

private:
	QString m_currentPort;
	QString m_currentBoard;
	QString m_currentFilePath;
	QWidget *m_currentSource;
};

#endif // PLATFORMARDUINO_H
