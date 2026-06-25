#include "auth.h"
#include <string>

#ifndef ROUTES_H
#define ROUTES_H

void registerUser_route(Authenticator &auth);
void loginUser_route(Authenticator &auth);
void logoutUser_route(Authenticator &auth);
void print_edit_script(std::string &root_module);
void commit_edit_script(std::string &root_module);

#endif
