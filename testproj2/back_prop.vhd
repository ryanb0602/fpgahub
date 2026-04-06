library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity back_prop is
    Port (
        clk : in std_logic;
        reset_n : in std_logic;
        run : in std_logic;
        done : out std_logic;
        
        true_value : in std_logic_vector(7 downto 0); 
        predicted  : in std_logic_vector(3 downto 0);  
        score_gap  : in std_logic_vector(15 downto 0); -- Input from ARGMAX
        
        hidden_out_activation : in std_logic;         
        hidden_out_activation_addr : out unsigned(8 downto 0);
        
        train_we_ol           : out  std_logic;
        train_neuron_sel_ol   : out  unsigned(9 downto 0); 
        train_addr_ol         : out  unsigned(9 downto 0);
        train_data_write_reg_ol : out  std_logic_vector(7 downto 0);
        train_data_read_reg_ol  : in std_logic_vector(7 downto 0);
        
        pixel_read_addr : out unsigned(9 downto 0);
        pixel_read_data : in  std_logic;
        
        train_we_hl     : out std_logic;
        train_neuron_hl : out unsigned(9 downto 0);
        train_addr_hl   : out unsigned(9 downto 0);
        train_data_w_hl : out std_logic_vector(7 downto 0);
        train_data_r_hl : in  std_logic_vector(7 downto 0)
    );
end back_prop;

architecture Behavioral of back_prop is

    type state_type is (IDLE, OUTPUT_WEIGHTS, HIDDEN_WEIGHTS, FINISHED);
    signal state : state_type := IDLE;

    type output_layer_states is (BP_READ, BP_WAIT, BP_WAIT2, BP_FETCH, BP_CALC, BP_WRITE);
    signal ol_state : output_layer_states := BP_READ;

    type hidden_layer_states is (HL_READ, HL_WAIT, HL_WAIT2, HL_FETCH, HL_CALC, HL_WRITE);
    signal hl_state : hidden_layer_states := HL_READ;

    signal counter_i : unsigned(9 downto 0) := (others => '0'); 
    signal counter_j : unsigned(7 downto 0) := (others => '0'); 
    
    attribute max_fanout : integer;
    attribute max_fanout of counter_j : signal is 20;

    type grad_mem is array (0 to 255) of signed(15 downto 0);
    signal gradient : grad_mem := (others => (others => '0'));
    
    attribute ram_style : string;
    attribute ram_style of gradient : signal is "distributed";

    signal reg_old_weight : signed(7 downto 0);
    signal reg_activation : std_logic;
    
    signal grad_addr_reg : integer range 0 to 255;
    signal reg_grad_val : signed(15 downto 0);
    
begin

    process(clk)
        variable target_idx    : integer range 0 to 15;
        variable pred_idx      : integer range 0 to 15;
        variable current_weight : signed(7 downto 0);
        variable temp_weight    : signed(16 downto 0);
        variable grad_val       : signed(15 downto 0);
        
        -- Adaptive Scaling Variables
        variable v_gap         : signed(15 downto 0);
        variable error_shift   : integer range 0 to 3;
        variable weight_step   : integer range 0 to 60;
    
    begin
        if rising_edge(clk) then
            if reset_n = '0' then
                state <= IDLE;
                done  <= '0';
                train_we_ol <= '0';
                train_we_hl <= '0';
            else
                case state is

                    when IDLE =>
                        done <= '0';
                        train_we_ol <= '0';
                        train_we_hl <= '0';
                        counter_i <= (others => '0');
                        counter_j <= (others => '0');
                        ol_state  <= BP_READ;
                        hl_state  <= HL_READ;
                        if run = '1' then
                            gradient <= (others => (others => '0')); 
                            state <= OUTPUT_WEIGHTS;
                        end if;

                    when OUTPUT_WEIGHTS =>
                        case ol_state is
                            when BP_READ =>
                                hidden_out_activation_addr <= '0' & counter_j;
                                train_neuron_sel_ol <= counter_i + 256;
                                train_addr_ol <= "00" & counter_j;      
                                train_we_ol <= '0';
                                ol_state <= BP_WAIT;

                            when BP_WAIT  => ol_state <= BP_WAIT2;
                            when BP_WAIT2 => ol_state <= BP_FETCH;

                            when BP_FETCH =>
                                reg_old_weight <= signed(train_data_read_reg_ol);
                                reg_activation <= hidden_out_activation;
                                
                                reg_grad_val <= gradient(to_integer(counter_j));
                                grad_addr_reg <= to_integer(counter_j);
                                
                                ol_state <= BP_CALC;

                            when BP_CALC =>
                                target_idx := to_integer(unsigned(true_value(3 downto 0)));
                                pred_idx   := to_integer(unsigned(predicted));
                                v_gap      := signed(score_gap);
                                current_weight := reg_old_weight;
                            
                                -- 1. ADAPTIVE GAINS
                                -- If wrong, we use the error-based steps. 
                                -- If right, we use a small constant "Reward" step.
                                if target_idx /= pred_idx then
                                    if v_gap > 400 then
                                        error_shift := 1; weight_step := 15;
                                    elsif v_gap > 150 then
                                        error_shift := 0; weight_step := 10;
                                    else
                                        error_shift := 0; weight_step := 4;
                                    end if;
                                else
                                    error_shift := 0; 
                                    weight_step := 4; -- Small reward to increase confidence margin
                                end if;
                            
                                -- 2. DUAL-DIRECTION UPDATE (Always run, even if target = pred)
                                if reg_activation = '1' then
                                    -- ACTIVATION IS '1': Target wants Negative, Pred wants Positive
                                    if counter_i = target_idx then
                                        current_weight := current_weight - to_signed(weight_step, 8);
                                    elsif counter_i = pred_idx and target_idx /= pred_idx then
                                        -- Only punish the predicted winner if it was the WRONG winner
                                        current_weight := current_weight + to_signed(weight_step, 8);
                                    end if;
                                else
                                    -- ACTIVATION IS '0': Target wants Positive, Pred wants Negative
                                    if counter_i = target_idx then
                                        current_weight := current_weight + to_signed(weight_step, 8);
                                    elsif counter_i = pred_idx and target_idx /= pred_idx then
                                        -- Only punish the predicted winner if it was the WRONG winner
                                        current_weight := current_weight - to_signed(weight_step, 8);
                                    end if;
                                end if;
                            
                                -- 3. SATURATION & GRADIENT
                                if current_weight > 127 then current_weight := to_signed(127, 8);
                                elsif current_weight < -128 then current_weight := to_signed(-128, 8);
                                end if;
                            
                                train_data_write_reg_ol <= std_logic_vector(current_weight);
                            
                                -- Only push gradients back to Hidden Layer if we were WRONG
                                -- Reinforcing correct answers is good for the OL, but can overfit the HL
                                if target_idx /= pred_idx then
                                    if counter_i = target_idx then
                                        gradient(grad_addr_reg) <= reg_grad_val + shift_left(resize(reg_old_weight, 16), error_shift);
                                    end if;
                                    if counter_i = pred_idx then
                                        gradient(grad_addr_reg) <= reg_grad_val - shift_left(resize(reg_old_weight, 16), error_shift);
                                    end if;
                                end if;
                            
                                ol_state <= BP_WRITE;

                            when BP_WRITE =>
                                train_we_ol <= '1';
                                if counter_i = 9 and counter_j = 255 then
                                    train_we_ol <= '0';
                                    counter_i <= (others => '0');
                                    counter_j <= (others => '0');
                                    state <= HIDDEN_WEIGHTS;
                                elsif counter_j = 255 then
                                    counter_j <= (others => '0');
                                    counter_i <= counter_i + 1;
                                    ol_state <= BP_READ;
                                else
                                    counter_j <= counter_j + 1;
                                    ol_state <= BP_READ;
                                end if;
                        end case;

                    when HIDDEN_WEIGHTS =>
                        -- [Logic remains the same: reads weights and pixels, then applies HL_CALC]
                        case hl_state is
                            when HL_READ =>
                                pixel_read_addr <= counter_i;
                                train_neuron_hl <= "00" & counter_j;
                                train_addr_hl   <= counter_i;
                                train_we_hl <= '0';
                                hl_state <= HL_WAIT;

                            when HL_WAIT  => hl_state <= HL_WAIT2;
                            when HL_WAIT2 => hl_state <= HL_FETCH;

                            when HL_FETCH =>
                                reg_old_weight <= signed(train_data_r_hl);
                                hl_state <= HL_CALC;

                            when HL_CALC =>
                                temp_weight := resize(reg_old_weight, 17);
                                -- Learning Rate Shift: Slow down absorption for stability
                                grad_val    := shift_right(gradient(to_integer(counter_j)), 6);
                            
                                if pixel_read_data = '1' then
                                    temp_weight := temp_weight - grad_val; 
                                else
                                    temp_weight := temp_weight + grad_val;
                                end if;
                            
                                -- Saturation
                                if temp_weight > 127 then
                                    current_weight := to_signed(127, 8);
                                elsif temp_weight < -128 then
                                    current_weight := to_signed(-128, 8);
                                else
                                    current_weight := resize(temp_weight, 8);
                                end if;
                            
                                train_data_w_hl <= std_logic_vector(current_weight);
                                train_we_hl <= '1';
                                hl_state <= HL_WRITE;

                            when HL_WRITE =>
                                train_we_hl <= '0';
                                if counter_i = 783 and counter_j = 255 then
                                    state <= FINISHED;
                                elsif counter_i = 783 then
                                    counter_i <= (others => '0');
                                    counter_j <= counter_j + 1;
                                    hl_state <= HL_READ;
                                else
                                    counter_i <= counter_i + 1;
                                    hl_state <= HL_READ;
                                end if;
                        end case;

                    when FINISHED =>
                        done <= '1';
                        if run = '0' then
                            state <= IDLE;
                        end if;
                end case;
            end if;
        end if;
    end process;
end Behavioral;