#ifndef BLINKBOARDWIDGET_H
#define BLINKBOARDWIDGET_H

#include <QGroupBox>
#include <QPushButton>
#include <QScrollArea>
#include <QVBoxLayout>
#include <QProcess>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QDebug>
#include <QTextEdit>
#include <QLineEdit>
#include <QHBoxLayout>

class BlinkBoardWidget : public QScrollArea {
  Q_OBJECT
public:
  BlinkBoardWidget(QWidget *parent = nullptr);
  ~BlinkBoardWidget() = default;

  void updateContent();
  void resetLayout();

protected slots:
  void handleButtonClick();
  void handleNodeProcessOutput();
  void handleNodeProcessError();
  void handleNodeStarted();
  void handleNodeError(QProcess::ProcessError error);
  void handleNodeFinished(int exitCode, QProcess::ExitStatus exitStatus);
  void handleSendMessage();
  void handleMessageReceived(const QString &message);

protected:
  QPushButton *m_actionButton;
  QVBoxLayout *m_mainLayout;
  QGroupBox *m_groupBox;
  QProcess *m_nodeProcess;
  
  // Chat interface elements
  QTextEdit *m_chatDisplay;
  QLineEdit *m_messageInput;
  QPushButton *m_sendButton;
  QHBoxLayout *m_inputLayout;
  
  void startNodeBackend();
  void sendCommandToNode(const QString &command);
  void addChatMessage(const QString &message, bool isUser = true);
};
#endif
