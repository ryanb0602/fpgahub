import React, { useState } from "react";
import { Section, Heading, Card, Button } from "@radix-ui/themes";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { PlayIcon } from "@radix-ui/react-icons";

export const ModuleViewer = ({ name }) => {
  const [moduleTextVal, setModuleTextVal] = useState("");

  return (
    <>
      <Section
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Card
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: "20%",
              display: "flex",
              flexDirection: "row",
              alignContent: "center",
              paddingBottom: "10px",
            }}
          >
            <Button variant="primary" size="2" /*onClick={}*/>
              <PlayIcon />
            </Button>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "10px",
              width: "100%",
            }}
          >
            <CodeMirror
              style={{ width: "50%" }}
              height="70vh"
              extensions={[StreamLanguage.define(vhdl)]}
              editable={false}
              theme={monokai}
              value={moduleTextVal}
            />
            <CodeMirror
              style={{ width: "50%" }}
              height="70vh"
              extensions={[StreamLanguage.define(vhdl)]}
              editable={false}
              theme={monokai}
              value={"placeholder"}
            />
          </div>
          <div style={{ height: "10px" }} />
          <CodeMirror
            style={{ width: "100%" }}
            height="20vh"
            extensions={[]}
            editable={false}
            theme={monokai}
            basicSetup={{
              lineNumbers: false,
              highlightActiveLine: false,
            }}
            value={"placeholder"}
          />
        </Card>
      </Section>
    </>
  );
};

export default ModuleViewer;
