#include "../include/routes.h"
#include "../include/auth.h"
#include "../include/cfg.h"
#include "../include/colors.h"
#include "../include/utils.h"
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

  std::string token;
  std::string app_name = APP_NAME;

  if (load_token(token, app_name)) {
    std::cout << GREEN << "Already logged in." << RESET << std::endl;
    auth.storeAuthToken(token);
    return;
  }

  std::string email, password;
  std::cout << "Enter Email: ";
  std::cin >> email;
  std::cout << "Enter Password: ";
  std::cin >> password;

  auth.loginUser(email, password);
}

void logoutUser_route(Authenticator &auth) {
  std::string app_name = APP_NAME;
  delete_token(app_name);
  std::string empty_token;
  auth.storeAuthToken(empty_token);
}

void status_route(FileTracker &fileTracker) {
  std::vector<FileTracker::changeInfo> changes = fileTracker.file_status();

  if (changes.empty()) {
    std::cout << GREEN << "No changes detected." << RESET << std::endl;
    return;
  }

  for (const auto &change : changes) {
    if (change.change_type == "new") {
      std::cout << GREEN << "Added: " << change.filename << RESET << std::endl;
    } else if (change.change_type == "modified") {
      std::cout << YELLOW << "Modified: " << change.filename << RESET
                << std::endl;
    } else if (change.change_type == "deleted") {
      std::cout << RED << "Deleted: " << change.filename << RESET << std::endl;
    }
  }
}

void commit_route(FileTracker &fileTracker, Authenticator &auth) {

  // module tracking

  fileTracker.commit(auth);
}
