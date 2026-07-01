#include "../include/graph_differencing_engine.h"

#include "../include/json.hpp"
#include <filesystem>

#include <fstream>
#include <ranges>
#include <sstream>

namespace fs = std::filesystem;

using json = nlohmann::json;

void graph_differencing_engine::gde_push(Authenticator &auth) {
  std::vector<std::string> repo_commits = this->fetch_origin_commits(auth);
  std::vector<std::string> needed_commits = this->commits_to_send(repo_commits);

  if (needed_commits.empty()) {
    std::cout << "All commits are up to date." << std::endl;
    return;
  }

  httplib::Client cli(API_BASE_URL, API_PORT);
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  json all_commits_payload = json::array();

  for (const std::string &commit_hash : needed_commits) {
    std::cout << "Pushing commit: " << commit_hash << std::endl;

    std::string parent_commit;

    json edit_script =
        parse_cached_edit_script_to_json(commit_hash, parent_commit);
    json graph_data = parse_cached_graph_to_json(commit_hash);

    json payload = {{"new_commit", commit_hash},
                    {"parent_commit", parent_commit},
                    {"graph", graph_data},
                    {"edit_script", edit_script}};

    all_commits_payload.push_back(payload);
  }

  std::string push_data = all_commits_payload.dump();
  auto res =
      cli.Post("/transactions/push", headers, push_data, "application/json");

  if (res && (res->status == 200 || res->status == 201)) {
    std::cout << "Successfully pushed" << std::endl;
  } else {
    std::cerr << "Failed to push commit" << std::endl;
    if (res)
      std::cerr << "Server response: " << res->body << std::endl;
  }
}

std::vector<std::string>
graph_differencing_engine::fetch_origin_commits(Authenticator &auth) {

  httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
  // Custom headers
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  auto res = cli.Get("/transactions/commits", headers);

  json j = json::parse(res->body);

  std::vector<std::string> commits;
  std::vector<std::string> timestamps;

  for (const auto &row : j) {
    if (!row.contains("id"))
      continue;
    if (!row.contains("timestamp"))
      continue;

    commits.push_back(row["id"]);
    timestamps.push_back(row["timestamp"]);
  }

  std::vector<size_t> indices(commits.size());
  std::iota(indices.begin(), indices.end(), 0);

  std::sort(indices.begin(), indices.end(),
            [&](size_t a, size_t b) { return timestamps[a] < timestamps[b]; });

  std::vector<std::string> sorted_commits;

  for (size_t i = 0; i < indices.size(); ++i) {
    sorted_commits[i] = commits[indices[i]];
  }

  return sorted_commits;
}

std::vector<std::string> graph_differencing_engine::commits_to_send(
    std::vector<std::string> &repo_commits) {

  std::unordered_set<std::string> repo_commits_set;
  std::vector<std::string> needed_commits;

  repo_commits_set.insert_range(repo_commits);

  if (fs::exists(CACHE_DIR) && fs::is_directory(CACHE_DIR)) {
    for (const auto &entry : fs::directory_iterator(CACHE_DIR)) {
      if (fs::is_directory(entry)) {

        std::string commit_name = entry.path().filename().string();

        if (!repo_commits_set.contains(commit_name)) {
          needed_commits.push_back(commit_name);
        }
      }
    }
  }

  return needed_commits;
}

json parse_cached_graph_to_json(const std::string &commit_hash) {
  fs::path graph_file = fs::path(CACHE_DIR) / commit_hash / "graph";
  std::ifstream in(graph_file);

  json graph_json = {{"modules", json::array()}, {"edges", json::array()}};

  if (!in.is_open())
    return graph_json;

  json current_mod;
  std::string line, token;

  while (std::getline(in, line)) {
    std::stringstream ss(line);
    ss >> token;

    if (token == "MODULE") {
      current_mod = json::object();
      std::string name, hash, merk_hash;
      ss >> name >> hash >> merk_hash;

      current_mod["name"] = name;
      current_mod["hash"] = hash;
      current_mod["merk_hash"] = merk_hash;
      current_mod["files"] = json::array();
      current_mod["child_interfaces"] = json::array();
    } else if (token == "FILE") {
      std::string filename;
      ss >> filename;
      current_mod["files"].push_back(filename);
    } else if (token == "CHILD") {
      std::string child_name, child_hash;
      ss >> child_name >> child_hash;

      current_mod["child_interfaces"].push_back(
          {{"name", child_name}, {"hash", child_hash}});

      graph_json["edges"].push_back(
          {{"from", current_mod["name"]}, {"to", child_name}});
    } else if (token == "END_MODULE") {
      graph_json["modules"].push_back(current_mod);
    }
  }

  return graph_json;
}

json parse_cached_edit_script_to_json(const std::string &commit_hash,
                                      std::string &out_parent_commit) {
  fs::path script_file = fs::path(CACHE_DIR) / commit_hash / "editscript";
  std::ifstream in(script_file);

  json script_json = json::array();
  if (!in.is_open())
    return script_json;

  std::string line, token;
  while (std::getline(in, line)) {
    std::stringstream ss(line);
    ss >> token;

    if (token == "PARENT") {
      ss >> out_parent_commit;
    } else if (token == "UPDATE") {
      std::string name, hash, file, merk;
      ss >> name >> hash >> file >> merk;
      script_json.push_back({{"action", "UPDATE"},
                             {"name", name},
                             {"hash", hash},
                             {"file", file},
                             {"merk_hash", merk}});
    } else if (token == "ADD") {
      std::string parent, name, hash;
      ss >> parent >> name >> hash;
      script_json.push_back({{"action", "ADD"},
                             {"parent", parent},
                             {"module", name},
                             {"hash", hash}});
    } else if (token == "DISCONNECT") {
      std::string parent, name;
      ss >> parent >> name;
      script_json.push_back(
          {{"action", "DISCONNECT"}, {"parent", parent}, {"module", name}});
    } else if (token == "MOVE") {
      std::string old_p, new_p, name;
      ss >> old_p >> new_p >> name;
      script_json.push_back({{"action", "MOVE"},
                             {"old_parent", old_p},
                             {"new_parent", new_p},
                             {"module", name}});
    }
  }

  return script_json;
}
