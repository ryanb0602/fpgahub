#include "auth.h"
#include "filetracking.h"

#ifndef ROUTES_H
#define ROUTES_H

void registerUser_route(Authenticator &auth);
void loginUser_route(Authenticator &auth);
void logoutUser_route(Authenticator &auth);
void status_route(FileTracker &fileTracker);

#endif
