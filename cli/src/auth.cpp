#include "../include/auth.h"
#include "../include/cfg.h"
#include "../include/colors.h"
#include "../include/httplib.h"
#include "../include/json.hpp"
#include "../include/utils.h"
#include <string>

bool Authenticator::registerUser(std::string &firstName, std::string &lastName,
                                 std::string &email, std::string &password) {

  httplib::Client cli(API_BASE_URL, API_PORT);

  std::string jsonPayload = "{\n"
                            "  \"firstname\": \"" +
                            firstName +
                            "\",\n"
                            "  \"lastname\": \"" +
                            lastName +
                            "\",\n"
                            "  \"email\": \"" +
                            email +
                            "\",\n"
                            "  \"password\": \"" +
                            password +
                            "\"\n"
                            "}";

  httplib::Headers headers = {{"Content-Type", "application/json"}};
  if (auto res = cli.Post("/auth/register", headers, jsonPayload,
                          "application/json")) {
    nlohmann::json j = nlohmann::json::parse(res->body);
    std::string message = j["message"];

    // remove " from message
    message.erase(remove(message.begin(), message.end(), '\"'), message.end());
    if (res->status == 201) {
      std::cout << GREEN << message << RESET << std::endl;
    } else {
      std::cout << RED << message << RESET << std::endl;
    }
    return res && res->status == 201;
  } else {
    std::cerr << "Error: " << res.error() << std::endl;
  }
}

bool Authenticator::storeAuthToken(std::string &token) {
  this->authToken = token;
  return true;
}

bool Authenticator::loginUser(std::string &username, std::string &password) {
  httplib::Client cli(API_BASE_URL, API_PORT);

  std::string jsonPayload = "{\n"
                            "  \"email\": \"" +
                            username +
                            "\",\n"
                            "  \"password\": \"" +
                            password +
                            "\"\n"
                            "}";

  httplib::Headers headers = {{"Content-Type", "application/json"}};
  if (auto res = cli.Post("/auth/cli-token", headers, jsonPayload,
                          "application/json")) {
    if (res->status == 200) {
      nlohmann::json j = nlohmann::json::parse(res->body);
      std::string message = j["message"];
      std::string token = j["token"];

      // remove " from message
      message.erase(remove(message.begin(), message.end(), '\"'),
                    message.end());

      std::cout << GREEN << message << RESET << std::endl;
      this->storeAuthToken(token);
      std::string app_name = APP_NAME;
      save_token(token, app_name);
    } else {
      std::cout << RED << "Problem storing token, check email or password."
                << RESET << std::endl;
    }
    return res && res->status == 200;
  } else {
    std::cerr << "Error: " << res.error() << std::endl;
  }
}
