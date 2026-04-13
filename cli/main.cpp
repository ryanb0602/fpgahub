#include "./include/CLI11.hpp"
#include "./include/auth.h"
#include "./include/cfg.h"
#include "./include/filetracking.h"
#include "./include/module_tree_builder.h"
#include "./include/routes.h"
#include "./include/utils.h"
#include <string>

#include "./include/ghdl_harness.h"

int main(int argc, char **argv) {

  Authenticator auth;
  ModuleTreeBuilder builder;

  CLI::App app{"CLI tool to interface with the VHDLhub system."};

  FileTracker tracker(HIDDEN_DIR_NAME, LOG_FILE_NAME);

  auto registerUser =
      app.add_subcommand("register", "Register new user for an account.");
  registerUser->callback([&]() { registerUser_route(auth); });

  auto loginUser = app.add_subcommand("login", "Login to an existing account.");
  loginUser->callback([&]() { loginUser_route(auth); });

  auto logoutUser =
      app.add_subcommand("logout", "Logout and clear authentication data.");
  logoutUser->callback([&]() { logoutUser_route(auth); });

  auto status = app.add_subcommand("status", "Check file change status.");
  status->callback([&]() { status_route(tracker); });

  auto commit = app.add_subcommand("commit", "Commit changes to the remote.");
  commit->callback([&]() { commit_route(tracker, auth, builder); });

  auto printTree = app.add_subcommand("module-tree", "Print the module tree.");
  printTree->callback([&]() {
    builder.buildTree();
    builder.printTreeWrapper();
  });

auto astTest = app.add_subcommand("ast-test", "Parse and print module tree using GHDL.");
  std::string vhdl_file;
  astTest->add_option("file", vhdl_file, "VHDL file to parse")->required();

  std::vector<std::string> ghdl_args;
  // Change 'app' to 'astTest' here:
  astTest->add_option("--ghdl-args", ghdl_args, "Additional arguments to pass to GHDL (e.g. -fsynopsys)");

  astTest->callback([&]() {
      GhdlHarness harness;
      harness.print_module_tree(vhdl_file, ghdl_args);
  });

  auto printRoots =
      app.add_subcommand("module-roots", "Print the module roots.");
  printRoots->callback([&]() {
    builder.buildTree();
    builder.printRoots();
  });

  CLI11_PARSE(app, argc, argv);


  return 0;
}
