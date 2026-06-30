#include "../include/graph_differencing_engine.h"

#include "../include/json.hpp"
#include <filesystem>

namespace fs = std::filesystem;

using json = nlohmann::json;

void graph_differencing_engine::gde_push(Authenticator &auth) {
  std::vector<std::string> repo_commits = this->fetch_origin_commits(auth);
  std::vector<std::string> needed_commits = this->commits_to_send(repo_commits);
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
