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

  auto slang = app.add_subcommand("slang", "slang test");

  slang->add_option("module_name", root_module, "Name of the module to diff")
      ->required();
  slang->callback([&]() {
    graph new_graph;
    new_graph.load_from_file();

    for (const graph::module *m : new_graph.modules) {
      std::cout << m->name << " " << m->id << " " << m->merk_hash << std::endl;
    }

    for (const graph::edge *e : new_graph.edges) {
      std::cout << e->from->name << " " << e->from->id << " -> " << e->to->name
                << " " << e->to->id << std::endl;
    }

    /*
    slang_wrapper slang_wrap;
    slang_wrap.load_to_FPGAHub_format();

    graph_differencing_engine gde;
    gde.load_current_graph(slang_wrap.retrieve_graph());

    gde.test_function(root_module);
        */
  });

  CLI11_PARSE(app, argc, argv);

  return 0;
}
