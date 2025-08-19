#include "blinkboardwidget.h"
#include <QFrame>
#include <QProcess>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QFileInfo>
#include <QDomDocument>
#include <QDomElement>
#include <QHash>
#include <QList>
#include <QPointer>

// Forward declarations for sketch-related classes
class MainWindow;
class SketchAreaWidget;
class SketchWidget;
class BreadboardSketchWidget;
class SchematicSketchWidget;
class ConnectorItem;
class ErcData;

// Include the actual headers
#include "../mainwindow/mainwindow.h"
#include "../mainwindow/sketchareawidget.h"
#include "../sketch/sketchwidget.h"
#include "../sketch/breadboardsketchwidget.h"
#include "../sketch/schematicsketchwidget.h"
#include "../connectors/connectoritem.h"
#include "../connectors/ercdata.h"
#include "../viewlayer.h"

BlinkBoardWidget::BlinkBoardWidget(QWidget *parent)
    : QScrollArea(parent), m_actionButton(new QPushButton(tr("Connect to Node.js Backend"))),
      m_mainLayout(new QVBoxLayout()),
      m_nodeProcess(new QProcess(this)),
      m_chatDisplay(new QTextEdit()),
      m_messageInput(new QLineEdit()),
      m_sendButton(new QPushButton("Send")),
      m_updateSchematicsButton(new QPushButton("Update Schematics")),
      m_inputLayout(new QHBoxLayout()) {

  auto frame = new QFrame(this);

  m_mainLayout->setSizeConstraint(QLayout::SetMinAndMaxSize); // Remove size constraint
  m_mainLayout->setObjectName("BlinkBoardFrame");
  m_mainLayout->setContentsMargins(0, 0, 0, 0); // Remove margins to use full width
  
  // Setup chat display
  m_chatDisplay->setReadOnly(true);
  m_chatDisplay->setMinimumWidth(400); // Set minimum width
  m_chatDisplay->setPlaceholderText("Chat messages will appear here...");
  m_chatDisplay->setStyleSheet("QTextEdit { background-color:rgb(243, 243, 243); border: 1px solid #b1b1b1; border-radius: 0px; padding: 5px; font-family: 'Droid Sans'; font-size: 11px; color: #323232; }");
  m_chatDisplay->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);

  // Setup message input
  m_messageInput->setPlaceholderText("Type your message here...");
  m_messageInput->setMinimumWidth(300); // Set minimum width
  m_messageInput->setStyleSheet("QLineEdit { padding: 5px; border: 1px solid #b1b1b1; border-radius: 0px; background: #ececec; color: #323232; font-family: 'Droid Sans'; font-size: 11px; } QLineEdit:focus { border: 1px solid #f23926; }");
  m_messageInput->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

  // Setup send button
  m_sendButton->setStyleSheet("QPushButton { padding: 5px 15px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
  m_sendButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);

  // Setup update schematics button
  m_updateSchematicsButton->setStyleSheet("QPushButton { padding: 5px 15px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");
  m_updateSchematicsButton->setSizePolicy(QSizePolicy::Fixed, QSizePolicy::Fixed);

  // Setup input layout
  m_inputLayout->addWidget(m_messageInput);
  m_inputLayout->addWidget(m_sendButton);
  m_inputLayout->addWidget(m_updateSchematicsButton);
  m_inputLayout->setStretch(0, 1); // Make message input expand
  m_inputLayout->setStretch(1, 0); // Keep send button fixed size
  m_inputLayout->setStretch(2, 0); // Keep update schematics button fixed size
  m_inputLayout->setContentsMargins(0, 0, 0, 0); // Remove margins

  // Setup Node.js connection button (at bottom) - match Fritzing button style
  m_actionButton->setStyleSheet("QPushButton { padding: 8px 16px; background: #ececec; color: #323232; border: 1px solid #b1b1b1; border-radius: 0px; font-family: 'Droid Sans'; font-size: 11px; margin-top: 10px; } QPushButton:hover { background: #666666; color: #ffffff; } QPushButton:pressed { background: #f23926; color: #d9d9d9; }");

  // Connect signals
  connect(m_actionButton, SIGNAL(clicked()), this, SLOT(handleButtonClick()));
  connect(m_sendButton, SIGNAL(clicked()), this, SLOT(handleSendMessage()));
  connect(m_updateSchematicsButton, SIGNAL(clicked()), this, SLOT(handleUpdateSchematics()));
  connect(m_messageInput, SIGNAL(returnPressed()), this, SLOT(handleSendMessage()));

  // Connect Node.js process signals
  connect(m_nodeProcess, &QProcess::readyReadStandardOutput, 
          this, &BlinkBoardWidget::handleNodeProcessOutput);
  connect(m_nodeProcess, &QProcess::readyReadStandardError, 
          this, &BlinkBoardWidget::handleNodeProcessError);

  // Add Process State Monitoring - Qt 5 compatible syntax
  connect(m_nodeProcess, SIGNAL(started()), this, SLOT(handleNodeStarted()));
  connect(m_nodeProcess, SIGNAL(errorOccurred(QProcess::ProcessError)), 
          this, SLOT(handleNodeError(QProcess::ProcessError)));
  connect(m_nodeProcess, SIGNAL(finished(int,QProcess::ExitStatus)), 
          this, SLOT(handleNodeFinished(int,QProcess::ExitStatus)));

  // Build the layout directly in main layout (no group box)
  m_mainLayout->setContentsMargins(10, 10, 10, 10);
  m_mainLayout->setSpacing(10); // Add spacing between elements
  
  // Add chat interface at the top
  m_mainLayout->addWidget(m_chatDisplay);
  m_mainLayout->addLayout(m_inputLayout);
  
  // Add separator - match Fritzing separator style
  auto separator = new QFrame();
  separator->setFrameShape(QFrame::HLine);
  separator->setFrameShadow(QFrame::Sunken);
  separator->setStyleSheet("QFrame { background-color: #b1b1b1; border: none; }");
  m_mainLayout->addWidget(separator);
  
  // Add Node.js connection button at the bottom
  m_mainLayout->addWidget(m_actionButton);
  
  // Set stretch factors to make chat area expand
  m_mainLayout->setStretch(0, 1); // Chat display gets most space
  m_mainLayout->setStretch(1, 0); // Input area fixed height
  m_mainLayout->setStretch(2, 0); // Separator fixed height
  m_mainLayout->setStretch(3, 0); // Button fixed height

  frame->setLayout(m_mainLayout);
  frame->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
  
  // Style the main frame to match Fritzing background
  frame->setStyleSheet("QFrame { background-color: #d9d9d9; border: none; }");

  this->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
  this->setWidget(frame);
  this->setWidgetResizable(true);
  this->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
  this->setFrameShape(QFrame::NoFrame);
  
  // Ensure the widget expands to fill available space
  this->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
  this->setMinimumWidth(500); // Set minimum width for the entire widget

  // Add welcome message
  addChatMessage("Welcome to BlinkBoard Chat! Connect to the Node.js backend to start chatting.", false);
}

void BlinkBoardWidget::updateContent() {
  // Update your widget content here
}

void BlinkBoardWidget::resetLayout() {
  // Reset your widget layout here
}

void BlinkBoardWidget::handleButtonClick() {
  if (m_nodeProcess->state() == QProcess::NotRunning) {
    qDebug() << "Attempting to start Node.js backend...";
    startNodeBackend();
  } else {
    qDebug() << "Node.js backend already running, sending ping...";
    sendCommandToNode("ping");
  }
}

void BlinkBoardWidget::startNodeBackend() {
  // Use hardcoded path to Node.js
  QString nodePath = "/usr/local/bin/node";
  
  // Check if the hardcoded path exists and is executable
  QFileInfo nodeFileInfo(nodePath);
  if (!nodeFileInfo.exists() || !nodeFileInfo.isExecutable()) {
    qDebug() << "❌ Node.js not found at hardcoded path:" << nodePath;
    m_actionButton->setText("Node.js Not Found");
    return;
  }
  
  qDebug() << "✅ Found Node.js at:" << nodePath;
  
  QStringList arguments;
  
  // Get the path to server.js relative to the source directory
  // Go up from build directory to source directory
  QString currentPath = QDir::currentPath();
  qDebug() << "Current working directory:" << currentPath;
  
  // Navigate up from build directory to source directory
  QString sourcePath = currentPath;
  if (sourcePath.contains("/build/")) {
    // Remove everything from /build/ onwards
    int buildIndex = sourcePath.indexOf("/build/");
    sourcePath = sourcePath.left(buildIndex);
    qDebug() << "Detected build directory, using source path:" << sourcePath;
  }
  
  QString serverPath = sourcePath + "/node-backend/server.js";
  
  qDebug() << "Source directory:" << sourcePath;
  qDebug() << "Server path:" << serverPath;
  
  // Check if file exists
  QFileInfo fileInfo(serverPath);
  if (!fileInfo.exists()) {
    qDebug() << "❌ Server.js file not found at:" << serverPath;
    qDebug() << "Tried to find it in:" << sourcePath;
    m_actionButton->setText("File Not Found - Check Path");
    return;
  }
  
  arguments << serverPath;
  
  qDebug() << "Starting Node.js process...";
  qDebug() << "Node path:" << nodePath;
  qDebug() << "Arguments:" << arguments;
  qDebug() << "Working directory:" << QDir::currentPath();
  
  m_nodeProcess->start(nodePath, arguments);
  
  if (m_nodeProcess->waitForStarted(5000)) { // 5 second timeout
    qDebug() << "✅ Node.js backend started successfully!";
    qDebug() << "Process ID:" << m_nodeProcess->processId();
    qDebug() << "Process state:" << m_nodeProcess->state();
    
    m_actionButton->setText("Connected - Click to Test");
    sendCommandToNode("init");
  } else {
    qDebug() << "❌ Failed to start Node.js backend!";
    qDebug() << "Error:" << m_nodeProcess->errorString();
    qDebug() << "Process state:" << m_nodeProcess->state();
    qDebug() << "Exit code:" << m_nodeProcess->exitCode();
    
    // Reset button text
    m_actionButton->setText("Failed - Click to Retry");
  }
}

void BlinkBoardWidget::sendCommandToNode(const QString &command) {
  if (m_nodeProcess->state() == QProcess::Running) {
    QJsonObject jsonCommand;
    jsonCommand["command"] = command;
    jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
    
    QJsonDocument doc(jsonCommand);
    QString jsonString = doc.toJson(QJsonDocument::Compact);
    
    qDebug() << "Sending to Node.js:" << jsonString;
    m_nodeProcess->write(jsonString.toUtf8() + "\n");
  } else {
    qDebug() << "Cannot send command - Node.js process not running";
    qDebug() << "Process state:" << m_nodeProcess->state();
  }
}

void BlinkBoardWidget::handleNodeProcessOutput() {
  QString output = QString::fromUtf8(m_nodeProcess->readAllStandardOutput());
  QStringList lines = output.split('\n', QString::SkipEmptyParts);
  
  for (const QString &line : lines) {
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(line.toUtf8(), &error);
    
    if (error.error == QJsonParseError::NoError) {
      QJsonObject response = doc.object();
      qDebug() << "✅ Received from Node.js:" << response;
      
      // Check if this is a chat message response
      if (response.contains("type") && response["type"].toString() == "chat") {
        QString message = response["message"].toString();
        if (!message.isEmpty()) {
          handleMessageReceived(message);
        }
      }
    } else {
      // Check if it's a raw chat message (non-JSON)
      if (line.startsWith("chat:")) {
        QString message = line.mid(5); // Remove "chat:" prefix
        handleMessageReceived(message);
      } else {
        qDebug() << " Raw output from Node.js:" << line;
      }
    }
  }
}

void BlinkBoardWidget::handleNodeProcessError() {
  QString error = QString::fromUtf8(m_nodeProcess->readAllStandardError());
  qDebug() << "❌ Node.js stderr:" << error;
}

void BlinkBoardWidget::handleNodeStarted() {
  qDebug() << "🎉 Node.js process started signal received!";
  qDebug() << "Process ID:" << m_nodeProcess->processId();
  qDebug() << "Process state:" << m_nodeProcess->state();
}

void BlinkBoardWidget::handleNodeError(QProcess::ProcessError error) {
  qDebug() << "💥 Node.js process error occurred:" << error;
  qDebug() << "Error string:" << m_nodeProcess->errorString();
  qDebug() << "Process state:" << m_nodeProcess->state();
  
  // Update button text
  m_actionButton->setText("Error - Click to Retry");
}

void BlinkBoardWidget::handleNodeFinished(int exitCode, QProcess::ExitStatus exitStatus) {
  qDebug() << "🏁 Node.js process finished!";
  qDebug() << "Exit code:" << exitCode;
  qDebug() << "Exit status:" << exitStatus;
  qDebug() << "Process state:" << m_nodeProcess->state();
  
  // Reset button text
  m_actionButton->setText("Disconnected - Click to Connect");
  
  // Add chat message about disconnection
  addChatMessage("Node.js backend disconnected.", false);
}

void BlinkBoardWidget::handleSendMessage() {
  QString message = m_messageInput->text().trimmed();
  if (message.isEmpty()) {
    return;
  }
  
  // Add user message to chat
  addChatMessage(message, true);
  
  // Clear input field
  m_messageInput->clear();
  
  // Send message to Node.js backend if connected
  if (m_nodeProcess->state() == QProcess::Running) {
    sendCommandToNode("chat:" + message);
  } else {
    addChatMessage("Not connected to backend. Please connect first.", false);
  }
}

void BlinkBoardWidget::handleMessageReceived(const QString &message) {
  addChatMessage(message, false);
}

void BlinkBoardWidget::addChatMessage(const QString &message, bool isUser) {
  QString timestamp = QDateTime::currentDateTime().toString("hh:mm:ss");
  QString formattedMessage;
  
  if (isUser) {
    formattedMessage = QString("<div style='text-align: right; margin: 5px;'><span style='background-color: #821f09; color: white; padding: 5px 10px; border-radius: 0px; display: inline-block; font-family: Droid Sans; font-size: 11px;'>%1</span><br><small style='color: #777777; font-family: Droid Sans; font-size: 9px;'>%2</small></div>")
                      .arg(message.toHtmlEscaped())
                      .arg(timestamp);
  } else {
    formattedMessage = QString("<div style='margin: 5px;'><span style='background-color: #ececec; color: #323232; padding: 5px 10px; border-radius: 0px; display: inline-block; border: 1px solid #b1b1b1; font-family: Droid Sans; font-size: 11px;'>%1</span><br><small style='color: #777777; font-family: Droid Sans; font-size: 9px;'>%2</small></div>")
                      .arg(message.toHtmlEscaped())
                      .arg(timestamp);
  }
  
  m_chatDisplay->append(formattedMessage);
  
  // Auto-scroll to bottom
  QTextCursor cursor = m_chatDisplay->textCursor();
  cursor.movePosition(QTextCursor::End);
  m_chatDisplay->setTextCursor(cursor);
}

void BlinkBoardWidget::handleUpdateSchematics() {
  if (m_nodeProcess->state() != QProcess::Running) {
    addChatMessage("Not connected to backend. Please connect first.", false);
    return;
  }

  // Get the current netlist XML
  QString netlistXml = currentNetlistXml();
  if (netlistXml.isEmpty()) {
    addChatMessage("Could not generate netlist. No sketch available.", false);
    return;
  }

  // Add user message to chat
  addChatMessage("Updating schematics with current netlist...", true);

  // Send the netlist XML to the Node.js backend
  QJsonObject jsonCommand;
  jsonCommand["command"] = "update_schematics";
  jsonCommand["netlist"] = netlistXml;
  jsonCommand["timestamp"] = QDateTime::currentMSecsSinceEpoch();
  
  QJsonDocument doc(jsonCommand);
  QString jsonString = doc.toJson(QJsonDocument::Compact);
  
  qDebug() << "Sending netlist to Node.js:" << jsonString.left(200) + "...";
  m_nodeProcess->write(jsonString.toUtf8() + "\n");
}

// Helper function to find the main window from a widget
static MainWindow *findMainWindow(const QWidget *w) {
  const QWidget *p = w;
  while (p) {
    if (auto mw = qobject_cast<MainWindow*>(p->window())) return mw;
    p = p->parentWidget();
  }
  return nullptr;
}

// Helper function to get the current sketch widget
static SketchWidget *currentSketchFrom(const QWidget *w) {
  if (auto mw = findMainWindow(w)) {
    auto list = mw->sketchWidgets();
    
    // For now, just return the first available sketch widget
    // This will typically be the breadboard view
    if (!list.isEmpty()) {
      return list[0];
    }
  }
  return nullptr;
}

// Helper function to get the breadboard sketch widget
static BreadboardSketchWidget *breadboardViewFrom(const QWidget *w) {
  if (auto mw = findMainWindow(w)) {
    auto list = mw->sketchWidgets();
    if (!list.isEmpty())
      return qobject_cast<BreadboardSketchWidget*>(list[0]);
  }
  return nullptr;
}

QString BlinkBoardWidget::currentNetlistXml() const {
  SketchWidget *sk = currentSketchFrom(this);
  if (!sk) return QString();

  QHash<ConnectorItem*, int> indexer;
  QList<QList<ConnectorItem*>*> nets;
  sk->collectAllNets(indexer, nets, true, sk->boardLayers() > 1);

  // Filter ignored connectors (ERC rules), mirroring exportNetlist()
  QList<QList<ConnectorItem*>*> toDelete;
  for (auto net : nets) {
    QList<ConnectorItem*> remove;
    for (auto ci : *net) {
      if (auto erc = ci->connectorSharedErcData()) {
        if (erc->ignore() == ErcData::Always) remove.append(ci);
        else if (erc->ignore() == ErcData::IfUnconnected && net->count() == 1) remove.append(ci);
      }
    }
    for (auto ci : remove) net->removeOne(ci);
    if (net->isEmpty()) toDelete.append(net);
  }
  for (auto net : toDelete) nets.removeOne(net);

  QDomDocument doc;
  doc.setContent(QString("<?xml version='1.0' encoding='UTF-8'?>\n"));
  QDomElement netlist = doc.createElement("netlist");
  netlist.setAttribute("date", QDateTime::currentDateTime().toString());
  doc.appendChild(netlist);

  for (auto net : nets) {
    QDomElement netEl = doc.createElement("net");
    netlist.appendChild(netEl);
    for (auto ci : *net) {
      QDomElement connEl = doc.createElement("connector");
      connEl.setAttribute("id", ci->connectorSharedID());
      connEl.setAttribute("name", ci->connectorSharedName());

      QDomElement partEl = doc.createElement("part");
      auto item = ci->attachedTo();
      partEl.setAttribute("id", item->id());
      partEl.setAttribute("label", item->instanceTitle());
      partEl.setAttribute("title", item->title());
      connEl.appendChild(partEl);

      if (auto erc = ci->connectorSharedErcData()) {
        QDomElement ercEl = doc.createElement("erc");
        if (erc->writeToElement(ercEl, doc)) connEl.appendChild(ercEl);
      }

      netEl.appendChild(connEl);
    }
  }

  for (auto net : nets) delete net;
  nets.clear();

  return doc.toString(-1);
}

QString BlinkBoardWidget::breadboardNetlistXml() const {
  if (auto bb = breadboardViewFrom(this)) {
    // Build the XML using the breadboard view specifically
    QHash<ConnectorItem*, int> indexer;
    QList<QList<ConnectorItem*>*> nets;
    bb->collectAllNets(indexer, nets, true, bb->boardLayers() > 1);

    QList<QList<ConnectorItem*>*> toDelete;
    for (auto net : nets) {
      QList<ConnectorItem*> remove;
      for (auto ci : *net) {
        if (auto erc = ci->connectorSharedErcData()) {
          if (erc->ignore() == ErcData::Always) remove.append(ci);
          else if (erc->ignore() == ErcData::IfUnconnected && net->count() == 1) remove.append(ci);
        }
      }
      for (auto ci : remove) net->removeOne(ci);
      if (net->isEmpty()) toDelete.append(net);
    }
    for (auto net : toDelete) nets.removeOne(net);

    QDomDocument doc;
    doc.setContent(QString("<?xml version='1.0' encoding='UTF-8'?>\n"));
    QDomElement netlist = doc.createElement("netlist");
    netlist.setAttribute("view", "breadboard");
    netlist.setAttribute("date", QDateTime::currentDateTime().toString());
    doc.appendChild(netlist);

    for (auto net : nets) {
      QDomElement netEl = doc.createElement("net");
      netlist.appendChild(netEl);
      for (auto ci : *net) {
        QDomElement connEl = doc.createElement("connector");
        connEl.setAttribute("id", ci->connectorSharedID());
        connEl.setAttribute("name", ci->connectorSharedName());

        QDomElement partEl = doc.createElement("part");
        auto item = ci->attachedTo();
        partEl.setAttribute("id", item->id());
        partEl.setAttribute("label", item->instanceTitle());
        partEl.setAttribute("title", item->title());
        connEl.appendChild(partEl);

        if (auto erc = ci->connectorSharedErcData()) {
          QDomElement ercEl = doc.createElement("erc");
          if (erc->writeToElement(ercEl, doc)) connEl.appendChild(ercEl);
        }

        netEl.appendChild(connEl);
      }
    }

    for (auto net : nets) delete net;
    nets.clear();

    return doc.toString(-1);
  }
  return QString();
}
