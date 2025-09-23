#include "../include/routes.h"
#include <iostream>

void registerUser_route(Authenticator &auth) {
  std::string firstname, lastname, email, password, confirm_password;
  std::cout << "Enter First Name: ";
  std::cin >> firstname;
  std::cout << "Enter Last Name: ";
  std::cin >> lastname;
  std::cout << "Enter Email: ";
  std::cin >> email;

  while (true) {
    std::cout << "Enter Password: ";
    std::cin >> password;
    std::cout << "Confirm Password: ";
    std::cin >> confirm_password;

    if (password == confirm_password) {
      break;
    } else {
      std::cout << "Passwords do not match. Please try again." << std::endl;
    }
  }

  auth.registerUser(firstname, lastname, email, password);
}

void loginUser_route(Authenticator &auth) {
  std::string email, password;
  std::cout << "Enter Email: ";
  std::cin >> email;
  std::cout << "Enter Password: ";
  std::cin >> password;

  // auth.loginUser(email, password);
}
