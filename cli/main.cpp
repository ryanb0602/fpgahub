#include "./include/CLI11.hpp"
#include "./include/auth.h"
#include "./include/cfg.h"
#include "./include/routes.h"
#include <iostream>
#include <ostream>
#include <string>

int main(int argc, char **argv) {

  Authenticator auth;

  CLI::App app{"CLI tool to interface with the VHDLhub system."};

  auto registerUser =
      app.add_subcommand("register", "Register new user for an account.");

  registerUser->callback([&]() { registerUser_route(auth); });

  auto loginUser = app.add_subcommand("login", "Login to an existing account.");

  loginUser->callback([&]() { loginUser_route(auth); });

  CLI11_PARSE(app, argc, argv);

  return 0;
}
