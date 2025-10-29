#include "./include/CLI11.hpp"
#include "./include/auth.h"
#include "./include/cfg.h"
#include "./include/filetracking.h"
#include "./include/module_tree_builder.h"
#include "./include/routes.h"
#include "./include/utils.h"
#include <string>

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

  auto printRoots =
      app.add_subcommand("module-roots", "Print the module roots.");
  printRoots->callback([&]() {
    builder.buildTree();
    builder.printRoots();
  });

  CLI11_PARSE(app, argc, argv);

  return 0;
}
