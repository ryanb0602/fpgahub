#include <string>

#ifndef UTILS_H
#define UTILS_H

std::string xdg_state_home_dir(std::string &app_name);
bool save_token(std::string &token, std::string &app_name);
bool load_token(std::string &token, std::string &app_name);
bool delete_token(std::string &app_name);

#endif
