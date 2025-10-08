#include "./cfg.h"
#include "./httplib.h"
#include <string>
#include <vector>

#ifndef UTILS_H
#define UTILS_H

#define AUTH_HEADER(token)                                                     \
  httplib::Headers {                                                           \
    {                                                                          \
      AUTH_HEADER_KEY, token                                                   \
    }                                                                          \
  }

std::string xdg_state_home_dir(std::string &app_name);
bool save_token(std::string &token, std::string &app_name);
bool load_token(std::string &token, std::string &app_name);
bool delete_token(std::string &app_name);
std::vector<std::string> list_files_recursive(const std::string &path);
std::string hashFile(const std::string &file_path);
std::string int_to_hex(int num);

#endif
