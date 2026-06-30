#include "./include/CLI11.hpp"
#include "./include/auth.h"
#include "./include/routes.h"
#include "./include/utils.h"

#include "./include/graph_differencing_engine.h"
#include "./include/slang_wrapper.h"

#include <string>

int main(int argc, char **argv) {

  Authenticator auth;

  CLI::App app{"CLI tool to interface with the VHDLhub system."};

  auto registerUser =
      app.add_subcommand("register", "Register new user for an account.");
  registerUser->callback([&]() { registerUser_route(auth); });

  auto loginUser = app.add_subcommand("login", "Login to an existing account.");
  loginUser->callback([&]() { loginUser_route(auth); });

  auto logoutUser =
      app.add_subcommand("logout", "Logout and clear authentication data.");
  logoutUser->callback([&]() { logoutUser_route(auth); });

  std::string root_module;

  auto status =
      app.add_subcommand("status", "Get edit script of uncommitted changes");

  status->add_option("module_name", root_module, "Name of the module to diff")
      ->required();
  status->callback([&]() { print_edit_script(root_module); });

  auto commit = app.add_subcommand("commit", "Save changes");

  commit->add_option("module_name", root_module, "Name of the module to diff")
      ->required();
  commit->callback([&]() { commit_edit_script(root_module); });

  auto push = app.add_subcommand("push", "Push local changes");

  push->callback([&]() { gde_push(auth); });

  CLI11_PARSE(app, argc, argv);

  return 0;
}
