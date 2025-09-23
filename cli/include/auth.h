#include <string>

#ifndef AUTH_H
#define AUTH_H

class Authenticator {
public:
  bool authenticate(std::string &username, std::string &password);
  bool registerUser(std::string &firstName, std::string &lastName,
                    std::string &email, std::string &password);
  bool loginUser(std::string &username, std::string &password);

private:
  bool pullAuthToken();
  bool storeAuthToken(std::string &uuid, std::string &token);

  std::string authToken;
  std::string uuid;
};

#endif
