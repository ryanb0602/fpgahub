#include "auth.h"
#include "filetracking.h"
#include "module_tree_builder.h"

#ifndef ROUTES_H
#define ROUTES_H

void registerUser_route(Authenticator &auth);
void loginUser_route(Authenticator &auth);
void logoutUser_route(Authenticator &auth);
void status_route(FileTracker &fileTracker);
void commit_route(FileTracker &fileTracker, Authenticator &auth,
                  ModuleTreeBuilder &moduleTreeBuilder);

#endif
