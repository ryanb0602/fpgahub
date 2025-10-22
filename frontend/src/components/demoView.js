import React, { useState } from "react";
import { Section, Heading, Card, Button } from "@radix-ui/themes";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { PlayIcon } from "@radix-ui/react-icons";

export default function DemoView() {
  const [terminalVal, setTerminalVal] = useState("");

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function simulateOutput() {
    setTerminalVal("");

    await sleep(500);

    setTerminalVal((prev) => prev + "Running...\n");
    await sleep(1000);

    setTerminalVal(
      (prev) => prev + "testbench.vhd:48:5:@25ns:(assertion note): Test done.",
    );
  }

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
          <Heading size="7">Preview Module Viewer!</Heading>
        </Section>
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
              <Button variant="primary" size="2" onClick={simulateOutput}>
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
                value={`library IEEE;
use IEEE.std_logic_1164.all;

entity full_adder is
	port (
    	A, B, Cin : in STD_LOGIC;
        Sum, Cout : out STD_LOGIC);
end full_adder;


architecture Behavioral of full_adder is
begin

	Sum <= A xor B xor Cin;
    Cout <= (A and B) or (A and Cin) or (B and Cin);

end architecture Behavioral;`}
              />
              <CodeMirror
                style={{ width: "50%" }}
                height="70vh"
                extensions={[StreamLanguage.define(vhdl)]}
                editable={false}
                theme={monokai}
                value={`library IEEE;
use IEEE.std_logic_1164.all;

entity testbench is
-- empty
end testbench;

architecture tb of testbench is

-- DUT component
component full_adder is
    port (
        A, B, Cin : in  STD_LOGIC;
        Sum, Cout : out STD_LOGIC
    );
end component;

-- Signals to connect to DUT
signal A, B, Cin : STD_LOGIC := '0';
signal Sum, Cout : STD_LOGIC;

begin

  -- Connect DUT
  DUT: full_adder port map(A, B, Cin, Sum, Cout);

  process
  begin
    -- Test 1: 0 + 0 + 0 = Sum:0, Cout:0
    A <= '0'; B <= '0'; Cin <= '0';
    wait for 1 ns;
    assert (Sum = '0') report "Fail: 0+0+0 Sum incorrect" severity error;
    assert (Cout = '0') report "Fail: 0+0+0 Cout incorrect" severity error;

    -- Test 2: 0 + 0 + 1 = Sum:1, Cout:0
    A <= '0'; B <= '0'; Cin <= '1';
    wait for 1 ns;
    assert (Sum = '1') report "Fail: 0+0+1 Sum incorrect" severity error;
    assert (Cout = '0') report "Fail: 0+0+1 Cout incorrect" severity error;

    -- Test 3: 0 + 1 + 0 = Sum:1, Cout:0
    A <= '0'; B <= '1'; Cin <= '0';
    wait for 1 ns;
    assert (Sum = '1') report "Fail: 0+1+0 Sum incorrect" severity error;
    assert (Cout = '0') report "Fail: 0+1+0 Cout incorrect" severity error;

    -- Simulation complete
    assert false report "Test done." severity note;
    wait;
  end process;

end tb;
`}
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
              value={terminalVal}
            />
          </Card>
        </Section>
      </Section>
    </>
  );
}
