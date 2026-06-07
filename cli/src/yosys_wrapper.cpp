#include "../include/yosys_wrapper.h"

#include "kernel/yosys.h"

void yosys_interface::test_project_read() {
  Yosys::yosys_setup();

  // 2. Create your own Design object (the empty database)
  Yosys::RTLIL::Design design;

  // 3. Command Yosys to parse the current directory into your design
  Yosys::run_pass("read_verilog *.v", &design);
  Yosys::run_pass("hierarchy -auto-top", &design);

  // 4. Analyze the DAG
  for (auto module : design.modules()) {
    printf("Analyzed module: %s\n", Yosys::log_id(module->name));
    // Put your DAG traversal logic here!
  }

  // 5. Clean up
  Yosys::yosys_shutdown();
}
