#include "../include/graph_differencing_engine.h"

std::vector<graph_differencing_engine::moduleEditType>
graph_differencing_engine::FPGAHub_gumtree::actionGenerator() {

  std::vector<moduleEditType> possible_edits;

  // find possible, unordered edit actions from the mappings
  // this is technically inefficient, loops over mapping list four times, but
  // more readable
  possible_edits.append_range(this->extractEditActions());
  possible_edits.append_range(this->extractMoveActions());
  this->populate_unmapped();
  possible_edits.append_range(this->extractAddActions());
  possible_edits.append_range(this->extractDisconnectActions());

  this->sort_edit_script(possible_edits);

  return possible_edits;
}

std::vector<graph_differencing_engine::updateModule>
graph_differencing_engine::FPGAHub_gumtree::extractEditActions() {

  std::vector<updateModule> edits;

  for (const auto &[key, value] : this->M) {
    if (key->hash != value->hash) {
      // found change and need to create edit action for it
      updateModule new_action = {value->name, value->getModuleBody()};
      edits.push_back(new_action);
    }
  }

  return edits;
}

std::vector<graph_differencing_engine::moveModule>
graph_differencing_engine::FPGAHub_gumtree::extractMoveActions() {

  std::vector<moveModule> moves;

  for (const auto &[key, value] : this->M) {
    // check if key or value is a root
    if (this->sg_parent_map.find(key->id) == this->sg_parent_map.end())
      continue;

    if (this->dg_parent_map.find(value->id) == this->dg_parent_map.end())
      continue;

    graph::module *m1_parent = this->sg_parent_map[key->id];
    graph::module *m2_parent = this->dg_parent_map[value->id];

    // if different parents, make move
    if (m1_parent->name != m2_parent->name) {

      moveModule new_move = {*value, *m1_parent, *m2_parent};
      moves.push_back(new_move);
    }
  }

  return moves;
}

void graph_differencing_engine::FPGAHub_gumtree::populate_unmapped() {

  std::vector<graph::module *> sg_modules;
  if (this->source_graph != nullptr) {
    sg_modules = this->source_graph->modules;
  }

  std::vector<graph::module *> dg_modules = this->destination_graph->modules;

  for (const auto &[key, value] : this->M) {

    std::erase(sg_modules, key);
    std::erase(dg_modules, value);
  }
  this->sg_unmapped = sg_modules;
  this->dg_unmapped = dg_modules;
}

std::vector<graph_differencing_engine::addModule>
graph_differencing_engine::FPGAHub_gumtree::extractAddActions() {

  std::vector<addModule> adds;

  for (graph::module *m : this->dg_unmapped) {

    if (this->dg_parent_map.find(m->id) == this->dg_parent_map.end()) {
      addModule add = {*m};
      adds.push_back(add);
      continue;
    }

    addModule add = {*m, *this->dg_parent_map[m->id]};
    adds.push_back(add);
  }

  return adds;
}

std::vector<graph_differencing_engine::disconnectModule>
graph_differencing_engine::FPGAHub_gumtree::extractDisconnectActions() {

  std::vector<disconnectModule> disconnects;

  for (graph::module *m : this->sg_unmapped) {
    if (this->sg_parent_map.find(m->id) != this->sg_parent_map.end()) {
      disconnectModule disconnect = {*m, *this->sg_parent_map[m->id]};
      disconnects.push_back(disconnect);
    } else {
      disconnectModule disconnect = {*m};
      disconnects.push_back(disconnect);
    }
  }

  this->coalesceDisconnects(disconnects);

  return disconnects;
}

void graph_differencing_engine::FPGAHub_gumtree::coalesceDisconnects(
    std::vector<disconnectModule> &disconnects) {

  std::unordered_set<std::string> removed_node_ids;
  for (const auto &d : disconnects) {
    removed_node_ids.insert(d.module_rem.id);
  }

  disconnects.erase(
      std::remove_if(disconnects.begin(), disconnects.end(),
                     [&removed_node_ids](const disconnectModule &d) {
                       return removed_node_ids.find(d.parent.id) !=
                              removed_node_ids.end();
                     }),
      disconnects.end());
}

void graph_differencing_engine::FPGAHub_gumtree::sort_edit_script(
    std::vector<moduleEditType> &edit_script) {

  // filter by type

  auto disconnects = edit_script |
                     std::views::filter([](const moduleEditType &met) {
                       return std::holds_alternative<disconnectModule>(met);
                     }) |
                     std::ranges::to<std::vector>();

  auto updates = edit_script |
                 std::views::filter([](const moduleEditType &met) {
                   return std::holds_alternative<updateModule>(met);
                 }) |
                 std::ranges::to<std::vector>();

  auto adds_moves = edit_script |
                    std::views::filter([](const moduleEditType &met) {
                      return std::holds_alternative<addModule>(met) ||
                             std::holds_alternative<moveModule>(met);
                    }) |
                    std::ranges::to<std::vector>();

  std::vector<moduleEditType> sorted_script;
  sorted_script.append_range(disconnects);

  // lookup map, m_id, met
  std::unordered_map<std::string, moduleEditType> lookup_map;

  // populate the lookup map
  for (moduleEditType &met : adds_moves) {
    if (auto *ptr = std::get_if<addModule>(&met)) {
      lookup_map[ptr->new_module.id] = met;
    } else if (auto *ptr = std::get_if<moveModule>(&met)) {
      lookup_map[ptr->module_move.id] = met;
    }
  }

  std::unordered_set<std::string> added_to_processed;
  std::stack<moduleEditType> process_stack;

  while (adds_moves.size() > 0 || process_stack.size() > 0) {
    if (process_stack.empty()) {
      moduleEditType back_item = adds_moves.back();
      adds_moves.pop_back();

      std::string my_id;
      if (auto *ptr = std::get_if<addModule>(&back_item)) {
        my_id = ptr->new_module.id;
      } else if (auto *ptr = std::get_if<moveModule>(&back_item)) {
        my_id = ptr->module_move.id;
      }

      // if this was already processed by being found as a dependency, ignore
      // this time
      if (added_to_processed.contains(my_id)) {
        continue;
      }

      process_stack.push(back_item);
    } else {
      // load from process stack
      moduleEditType stack_top = process_stack.top();

      std::string dependency_id;
      std::string my_id;
      // populate what the dependency id and current id are
      if (auto *ptr = std::get_if<addModule>(&stack_top)) {
        dependency_id = ptr->parent.id;
        my_id = ptr->new_module.id;
      } else if (auto *ptr = std::get_if<moveModule>(&stack_top)) {
        dependency_id = ptr->new_parent.id;
        my_id = ptr->module_move.id;
      }

      // if the dependency is already processed, it is okay to process this
      if (added_to_processed.contains(dependency_id)) {
        sorted_script.push_back(stack_top);
        added_to_processed.insert(my_id);
        process_stack.pop();
        continue;
      }
      // if we found a dependency, just add this to the stack and keep moving
      if (lookup_map.contains(dependency_id)) {
        process_stack.push(lookup_map[dependency_id]);
        continue;
      } else {
        // if this has no dependencies, it is the top of a chain and it is okay
        // to keep process
        // this will trigger sort of waterfall, rest of chain will be processed
        // after
        sorted_script.push_back(stack_top);
        added_to_processed.insert(my_id);
        process_stack.pop();
      }
    }
  }

  sorted_script.append_range(updates);
  edit_script = sorted_script;
}
