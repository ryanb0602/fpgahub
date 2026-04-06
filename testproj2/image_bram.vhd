library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity image_bram is
    Port (
        clk      : in  std_logic;
        -- Port A: Writing (From CommsWrapper)
        we       : in  std_logic;
        addr_w   : in  unsigned(9 downto 0); -- 0 to 1023
        data_in  : in  std_logic;
        -- Port B: Reading (To Neural Network)
        addr_r   : in  unsigned(9 downto 0);
        data_out : out std_logic
    );
end image_bram;

architecture RTL of image_bram is
    type ram_type is array (0 to 783) of std_logic;
    signal RAM : ram_type := (others => '0');

    signal data_out_internal : std_logic := '0';
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if we = '1' then
                RAM(to_integer(addr_w)) <= data_in;
            end if;

            data_out_internal <= RAM(to_integer(addr_r));
            
            data_out <= data_out_internal;
        end if;
    end process;
end RTL;