"""Optional desktop evidence viewer. Requires Python 3, PyQt5 and Node.js."""
import argparse
from pathlib import Path
import subprocess
import sys

from PyQt5.QtSvg import QSvgWidget
from PyQt5.QtGui import QFont
from PyQt5.QtWidgets import (
    QApplication, QComboBox, QHBoxLayout, QLabel, QPlainTextEdit,
    QVBoxLayout, QWidget,
)

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ("Campus topology", "rip", "diagram", "00-campus-topology"),
    ("Topology and addressing", "rip", "topology", "01-topology-and-addresses"),
    ("RIP routes and interfaces", "rip", "routes", "02-rip-routes-and-interfaces"),
    ("RIP connectivity and trace", "rip", "probe", "03-rip-reachability-and-trace"),
    ("OSPF routes and neighbors", "ospf", "routes", "04-ospf-routes-and-neighbors"),
    ("OSPF connectivity and trace", "ospf", "probe", "05-ospf-reachability-and-trace"),
    ("OSPF link failure", "ospf", "failure", "06-ospf-link-failure"),
    ("OSPF link restored", "ospf", "recovery", "07-ospf-link-restored"),
    ("RIP link failure", "rip", "failure", "08-rip-link-failure"),
    ("RIP link restored", "rip", "recovery", "09-rip-link-restored"),
]


class ResultsWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Campus routing lab")
        self.resize(1160, 800)
        self.setStyleSheet("QWidget{background:#eef4f1;color:#173f41;} "
            "QComboBox{background:white;padding:7px;border:1px solid #b4ccc3;border-radius:5px;} "
            "QPlainTextEdit{background:#122e39;color:#e8f5ed;border:0;padding:14px;}")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30,24,30,20)
        layout.setSpacing(10)
        identity = QLabel("GROUP 11     /     COMPUTER NETWORKS")
        identity.setStyleSheet("font-size:14px;font-weight:bold;color:#327168;")
        layout.addWidget(identity)
        header = QHBoxLayout()
        self.heading = QLabel()
        self.heading.setStyleSheet("font-size:30px;font-weight:bold;")
        self.select = QComboBox()
        self.select.addItems([case[0] for case in CASES])
        header.addWidget(self.heading)
        header.addStretch()
        header.addWidget(self.select)
        layout.addLayout(header)
        self.command = QLabel()
        self.command.setStyleSheet("font-size:15px;color:#315e59;")
        layout.addWidget(self.command)
        self.output = QPlainTextEdit()
        self.output.setReadOnly(True)
        self.output.setLineWrapMode(QPlainTextEdit.NoWrap)
        self.output.setFont(QFont("DejaVu Sans Mono",11))
        self.diagram = QSvgWidget(str(ROOT/"docs"/"topology.svg"))
        layout.addWidget(self.diagram,1)
        layout.addWidget(self.output,1)
        note=QLabel("Source · Campus routing model     |     Stable-state results     |     Cisco IOS configuration files included separately")
        note.setStyleSheet("font-size:13px;color:#4a6866;")
        layout.addWidget(note)
        self.select.currentIndexChanged.connect(self.refresh)
        self.refresh(0)

    def refresh(self,index):
        name, protocol, scenario, _ = CASES[index]
        self.heading.setText(name)
        self.output.setVisible(scenario!="diagram")
        self.diagram.setVisible(scenario=="diagram")
        if scenario=="diagram":
            self.command.setText("Three Cisco 2911 routers · Three Cisco 2960 switches · Six PCs")
            return
        cmd = ["node","lab/run.js",protocol,scenario]
        result = subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,
                                encoding="utf-8",check=True)
        self.heading.setText(name)
        self.command.setText(" ".join(cmd))
        self.output.setPlainText(result.stdout.rstrip())


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture",action="store_true",help="Capture all views to screenshots/")
    args=parser.parse_args()
    app=QApplication(sys.argv[:1])
    app.setStyle("Fusion")
    window=ResultsWindow()
    window.show()
    if args.capture:
        for i,case in enumerate(CASES):
            window.select.setCurrentIndex(i)
            app.processEvents()
            if window.output.isVisible() and (window.output.verticalScrollBar().maximum() or window.output.horizontalScrollBar().maximum()):
                raise RuntimeError("Clipped command output in "+case[0])
            target=ROOT/"screenshots"/(case[3]+".png")
            target.parent.mkdir(exist_ok=True)
            if not window.grab().save(str(target)):
                raise OSError("Could not save "+str(target))
        return
    sys.exit(app.exec_())


if __name__=="__main__":
    main()
