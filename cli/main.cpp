#include "./include/CLI11.hpp"
#include "./include/auth.h"
#include "./include/cfg.h"
#include <iostream>
#include <string>

int main(int argc, char **argv) {

  Authenticator auth;

  std::string firstname = "test1";
  std::string lastname = "test1";
  std::string email = "berubr@rpi.edu";
  std::string password = "password";

  auth.registerUser(firstname, lastname, email, password);

  return 0;
}
