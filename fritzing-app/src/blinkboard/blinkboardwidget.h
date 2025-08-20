#ifndef BLINKBOARDWIDGET_H
#define BLINKBOARDWIDGET_H

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
#include <QTimer>
#include <QLabel>
#include <QDialog>
#include <QComboBox>

class BlinkBoardWidget : public QScrollArea {
  Q_OBJECT
public:
  BlinkBoardWidget(QWidget *parent = nullptr);
  ~BlinkBoardWidget() = default;

  void updateContent();
  void resetLayout();
  
  // Helper methods for accessing sketch data
  QString currentNetlistXml() const;
  QString breadboardNetlistXml() const;

public slots:
  void handleBlinkBoardConnectionRequest();
  void requestTestsFromBackend();

signals:
  void testsReceived(const QJsonArray &tests);
  void testGroupsUpdated(const QJsonArray &testGroups);

protected slots:
  void handleButtonClick();
  void handleNodeProcessOutput();
  void handleNodeProcessError();
  void handleNodeStarted();
  void handleNodeError(QProcess::ProcessError error);
  void handleNodeFinished(int exitCode, QProcess::ExitStatus exitStatus);
  void handleSendMessage();
  void handleMessageReceived(const QString &message);
  void handleUpdateSchematics();

protected:
  QPushButton *m_actionButton;
  QVBoxLayout *m_mainLayout;
  QProcess *m_nodeProcess;
  
  // Status indicator
  QLabel *m_statusIndicator;
  
  // Loading indicator for AI responses
  QLabel *m_loadingIndicator;
  QTimer *m_loadingAnimationTimer;
  
  // Serial ports
  QJsonArray m_serialPorts;
  
  // Chat interface elements
  QTextEdit *m_chatDisplay;
  QLineEdit *m_messageInput;
  QPushButton *m_sendButton;
  QPushButton *m_updateSchematicsButton;
  QHBoxLayout *m_inputLayout;
  
  // Loading indicator for AI responses
  void startNodeBackend();
  void sendCommandToNode(const QString &command);
  void addChatMessage(const QString &message, bool isUser = true);
  void updateButtonColor(bool isConnected);
  
  // Simple streaming status handling
  void handleStreamingStart();
  void handleStreamingDone();
  
  // Serial port handling
  void handleSerialPortsReceived(const QJsonArray &ports);
  void showPortSelectionDialog();
  void connectToSelectedPort(const QString &portPath);
  
  // Test handling
  void handleTestsReceived(const QJsonArray &tests);
};
#endif
