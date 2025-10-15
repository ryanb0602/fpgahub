import React from "react";
import { Section, Heading } from "@radix-ui/themes";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { monokai } from "@uiw/codemirror-theme-monokai";

export default function DemoView() {
  return (
    <>
      <Section style={{ marginTop: "-400px" }}>
        <Section
          style={{
            width: "100%",
            height: "100px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Heading size="6">VHDL Code Editor Demo</Heading>
        </Section>
        <Section
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <CodeMirror
            style={{ flex: "1" }}
            height="200px"
            extensions={[StreamLanguage.define(vhdl)]}
            theme={monokai}
          />
          <CodeMirror
            style={{ flex: "1" }}
            height="200px"
            extensions={[StreamLanguage.define(vhdl)]}
            theme={monokai}
          />
          <div style={{ flex: "1" }}></div>
        </Section>
      </Section>
    </>
  );
}
